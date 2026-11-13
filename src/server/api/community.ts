import { z } from "zod";
import { db } from "../db";
import { publicName, requireAdult, requireUser, requireVerifiedAdult, type Auth } from "../auth";
import { bad, body, clean, forbidden, notFound, rateLimit } from "../http";
import { route } from "../router";
import {
  autoReport,
  awardXp,
  checkAchievements,
  grantAchievement,
  isDuplicate,
  isPremium,
  moderateText,
  notify,
  publish,
} from "../services";

/**
 * Pause Community — adults (18+) only. Every handler here calls requireAdult /
 * requireVerifiedAdult, so minor accounts are refused at the API regardless of
 * how the request is made.
 */

const dailyPrompts = [
  "What's one small thing that helped you this week?",
  "What does rest look like for you right now?",
  "Share a moment you were kind to yourself recently.",
  "What's something you're learning to let go of?",
  "Which song, place or person feels like a deep breath?",
  "What boundary are you proud of keeping?",
  "What would you tell yourself from a year ago?",
];

export function todaysPrompt() {
  const day = Math.floor(Date.now() / 86400000);
  return dailyPrompts[day % dailyPrompts.length]!;
}

type Sql = Awaited<ReturnType<typeof db>>;

/** SQL fragment: posts this viewer may see (visibility, blocks, mutes, removal). */
function visibleTo(sql: Sql, me: string) {
  return sql`p.status = 'visible' and a.status = 'active'
    and not exists (select 1 from blocks b where (b.blocker_id = ${me} and b.blocked_id = p.author_id) or (b.blocker_id = p.author_id and b.blocked_id = ${me}))
    and not exists (select 1 from mutes m where m.muter_id = ${me} and m.muted_id = p.author_id and not p.anonymous)
    and (p.anonymous or p.author_id = ${me} or a.profile_visibility = 'public'
      or (a.profile_visibility = 'followers' and exists (select 1 from follows f where f.follower_id = ${me} and f.followee_id = p.author_id)))
    and (c.id is null or c.status = 'active')`;
}

function postSelect(sql: Sql, me: string) {
  return sql`p.id, p.body, p.image_id, p.anonymous, p.kind, p.created_at, p.edited_at, p.community_id,
    c.slug as community_slug, c.name as community_name,
    case when p.anonymous then null else a.id end as author_id,
    case when p.anonymous then 'Anonymous member' when a.identity_mode = 'name' then a.display_name else a.community_alias end as author_name,
    case when p.anonymous then null else a.community_alias end as author_username,
    case when p.anonymous or a.identity_mode = 'alias' then null else a.avatar_id end as author_avatar,
    case when p.anonymous then 'anon' else a.avatar_style end as author_style,
    (p.author_id = ${me}) as mine,
    (select count(*) from reactions r where r.post_id = p.id)::int as reactions,
    (select count(*) from comments cm where cm.post_id = p.id and cm.status = 'visible')::int as comments,
    (select kind from reactions r where r.post_id = p.id and r.user_id = ${me}) as my_reaction,
    exists (select 1 from saved_posts s where s.post_id = p.id and s.user_id = ${me}) as saved`;
}

route("GET", "/community/feed", async ({ request, url }) => {
  const { user } = await requireAdult(request);
  const sql = await db();
  const tab = url.searchParams.get("tab") ?? "for-you";
  const slug = url.searchParams.get("community");
  const before = url.searchParams.get("before");
  const cursor =
    before && !Number.isNaN(Date.parse(before)) ? new Date(before) : new Date(Date.now() + 60000);
  const me = user.id;
  let filter = sql``;
  let order = sql`p.created_at desc`;
  if (slug) filter = sql`and c.slug = ${slug}`;
  else if (tab === "following")
    filter = sql`and p.author_id in (select followee_id from follows where follower_id = ${me}) and not p.anonymous`;
  else if (tab === "saved")
    filter = sql`and exists (select 1 from saved_posts s where s.post_id = p.id and s.user_id = ${me})`;
  else if (tab === "trending") {
    filter = sql`and p.created_at > now() - interval '3 days'`;
    order = sql`((select count(*) from reactions r where r.post_id = p.id) + 2 * (select count(*) from comments cm where cm.post_id = p.id)) desc, p.created_at desc`;
  } else if (tab === "for-you") {
    filter = sql`and (p.author_id = ${me} or p.author_id in (select followee_id from follows where follower_id = ${me})
      or p.community_id in (select community_id from community_members where user_id = ${me}) or p.community_id is null)`;
  }
  const premiumCommunity = await isPremium(user);
  const posts =
    await sql`select ${postSelect(sql, me)} from posts p join users a on a.id = p.author_id left join communities c on c.id = p.community_id
    where ${visibleTo(sql, me)} ${filter} and p.created_at < ${cursor}
      and (c.id is null or not c.premium or ${premiumCommunity})
    order by ${order} limit 20`;
  return { posts, prompt: todaysPrompt() };
});

route("POST", "/community/posts", async ({ request }) => {
  const { user } = await requireVerifiedAdult(request);
  rateLimit(`post:${user.id}`, 10, 60 * 60 * 1000);
  const input = await body(
    request,
    z.object({
      body: z.string().min(1).max(4000),
      communityId: z.string().uuid().nullable().optional(),
      imageId: z.string().uuid().nullable().optional(),
      anonymous: z.boolean().default(false),
      kind: z.enum(["post", "milestone", "prompt"]).default("post"),
    }),
  );
  const text = clean(input.body, 4000);
  if (!text) throw bad("Write something first.");
  const sql = await db();
  if (await isDuplicate("posts", user.id, text)) throw bad("You just posted that.");
  if (input.communityId) {
    const m =
      await sql`select 1 from community_members where community_id = ${input.communityId} and user_id = ${user.id}`;
    if (!m.length) throw forbidden("Join the community to post in it.");
  }
  if (input.imageId) {
    const img =
      await sql`select 1 from uploads where id = ${input.imageId} and owner_id = ${user.id} and scope = 'public'`;
    if (!img.length) throw bad("Image not found.");
  }
  const verdict = moderateText(text);
  if (verdict.action === "block")
    throw bad(
      "This post breaks our community guidelines, so it wasn't shared.",
      "moderation_blocked",
    );
  // Anonymity is the norm here, so anonymous posts go through the same automated
  // filters as everything else; anything flagged is held for human review.
  const status = verdict.action === "review" ? "pending" : "visible";
  const [post] =
    await sql`insert into posts (author_id, community_id, body, image_id, anonymous, kind, status)
    values (${user.id}, ${input.communityId ?? null}, ${text}, ${input.imageId ?? null}, ${input.anonymous}, ${input.kind}, ${status}) returning id`;
  if (verdict.action === "review") await autoReport("post", post!["id"] as string, verdict.reasons);
  await awardXp(user.id, 5, "post");
  await grantAchievement(user.id, "first_post");
  return { id: post!["id"], status };
});

route("PATCH", "/community/posts/:id", async ({ request, params }) => {
  const { user } = await requireVerifiedAdult(request);
  const input = await body(request, z.object({ body: z.string().min(1).max(4000) }));
  const text = clean(input.body, 4000);
  const verdict = moderateText(text);
  if (verdict.action === "block")
    throw bad("This edit breaks our community guidelines.", "moderation_blocked");
  const sql = await db();
  const rows =
    await sql`update posts set body = ${text}, edited_at = now(), status = case when ${verdict.action === "review"} then 'pending' else status end
    where id = ${params["id"]!} and author_id = ${user.id} and status <> 'removed' returning id`;
  if (!rows.length) throw notFound();
  if (verdict.action === "review") await autoReport("post", params["id"]!, verdict.reasons);
  return { ok: true };
});

route("DELETE", "/community/posts/:id", async ({ request, params }) => {
  const { user } = await requireAdult(request);
  const sql = await db();
  const rows =
    await sql`select p.author_id, p.community_id from posts p where p.id = ${params["id"]!}`;
  const post = rows[0];
  if (!post) throw notFound();
  const isMod = post["community_id"]
    ? (
        await sql`select 1 from community_members where community_id = ${post["community_id"]} and user_id = ${user.id} and role in ('moderator','owner')`
      ).length > 0
    : false;
  if (post["author_id"] !== user.id && !isMod && user.role === "user") throw forbidden();
  if (post["author_id"] === user.id) await sql`delete from posts where id = ${params["id"]!}`;
  else {
    await sql`update posts set status = 'removed' where id = ${params["id"]!}`;
    await sql`insert into moderation_actions (actor_id, target_kind, target_id, action) values (${user.id}, 'post', ${params["id"]!}, 'remove')`;
  }
  return { ok: true };
});

route("GET", "/community/posts/:id", async ({ request, params }) => {
  const { user } = await requireAdult(request);
  const sql = await db();
  const [post] =
    await sql`select ${postSelect(sql, user.id)} from posts p join users a on a.id = p.author_id left join communities c on c.id = p.community_id
    where p.id = ${params["id"]!} and (${visibleTo(sql, user.id)} or (p.author_id = ${user.id} and p.status = 'pending'))`;
  if (!post) throw notFound("This post isn't available.");
  const comments =
    await sql`select cm.id, cm.body, cm.parent_id, cm.created_at, a.id as author_id, case when a.identity_mode = 'name' then a.display_name else a.community_alias end as author_name, a.community_alias as author_username,
      case when a.identity_mode = 'name' then a.avatar_id end as author_avatar, a.avatar_style as author_style, (cm.author_id = ${user.id}) as mine
    from comments cm join users a on a.id = cm.author_id
    where cm.post_id = ${params["id"]!} and cm.status = 'visible' and a.status = 'active'
      and not exists (select 1 from blocks b where (b.blocker_id = ${user.id} and b.blocked_id = cm.author_id) or (b.blocker_id = cm.author_id and b.blocked_id = ${user.id}))
    order by cm.created_at limit 300`;
  return { post, comments };
});

route("POST", "/community/posts/:id/comments", async ({ request, params }) => {
  const { user } = await requireVerifiedAdult(request);
  rateLimit(`comment:${user.id}`, 40, 60 * 60 * 1000);
  const input = await body(
    request,
    z.object({
      body: z.string().min(1).max(2000),
      parentId: z.string().uuid().nullable().optional(),
    }),
  );
  const text = clean(input.body, 2000);
  const verdict = moderateText(text);
  if (verdict.action === "block")
    throw bad(
      "This comment breaks our community guidelines, so it wasn't posted.",
      "moderation_blocked",
    );
  const sql = await db();
  if (await isDuplicate("comments", user.id, text)) throw bad("You just said that.");
  const [post] =
    await sql`select p.id, p.author_id, p.anonymous from posts p join users a on a.id = p.author_id left join communities c on c.id = p.community_id
    where p.id = ${params["id"]!} and ${visibleTo(sql, user.id)}`;
  if (!post) throw notFound();
  const [c] = await sql`insert into comments (post_id, author_id, parent_id, body, status)
    values (${params["id"]!}, ${user.id}, ${input.parentId ?? null}, ${text}, ${verdict.action === "review" ? "pending" : "visible"}) returning id`;
  if (verdict.action === "review") await autoReport("comment", c!["id"] as string, verdict.reasons);
  else if (post["author_id"] !== user.id) {
    await notify(
      post["author_id"] as string,
      "community",
      `${publicName(user)} replied to your post`,
      text.slice(0, 120),
      `/community/post/${post["id"]}`,
    );
  }
  await awardXp(user.id, 3, "comment");
  await checkAchievements(user.id);
  return { id: c!["id"], status: verdict.action === "review" ? "pending" : "visible" };
});

route("DELETE", "/community/comments/:id", async ({ request, params }) => {
  const { user } = await requireAdult(request);
  const sql = await db();
  const rows =
    await sql`delete from comments where id = ${params["id"]!} and (author_id = ${user.id}
    or post_id in (select id from posts where author_id = ${user.id})) returning id`;
  if (!rows.length) throw notFound();
  return { ok: true };
});

route("POST", "/community/posts/:id/react", async ({ request, params }) => {
  const { user } = await requireVerifiedAdult(request);
  rateLimit(`react:${user.id}`, 300, 60 * 60 * 1000);
  const { kind } = await body(
    request,
    z.object({ kind: z.enum(["heart", "hug", "strength", "relate", "celebrate"]).nullable() }),
  );
  const sql = await db();
  if (!kind) {
    await sql`delete from reactions where post_id = ${params["id"]!} and user_id = ${user.id}`;
    return { ok: true };
  }
  const [post] =
    await sql`select p.author_id, p.anonymous from posts p join users a on a.id = p.author_id left join communities c on c.id = p.community_id
    where p.id = ${params["id"]!} and ${visibleTo(sql, user.id)}`;
  if (!post) throw notFound();
  const inserted =
    await sql`insert into reactions (post_id, user_id, kind) values (${params["id"]!}, ${user.id}, ${kind})
    on conflict (post_id, user_id) do update set kind = excluded.kind returning (xmax = 0) as fresh`;
  if (inserted[0]?.["fresh"] && post["author_id"] !== user.id && !post["anonymous"]) {
    await notify(
      post["author_id"] as string,
      "community",
      `${publicName(user)} sent support on your post`,
      "",
      `/community/post/${params["id"]}`,
    );
  }
  return { ok: true };
});

route("POST", "/community/posts/:id/save", async ({ request, params }) => {
  const { user } = await requireAdult(request);
  const sql = await db();
  const del =
    await sql`delete from saved_posts where post_id = ${params["id"]!} and user_id = ${user.id} returning post_id`;
  if (!del.length)
    await sql`insert into saved_posts (post_id, user_id) values (${params["id"]!}, ${user.id}) on conflict do nothing`;
  return { saved: !del.length };
});

// ---------------------------------------------------------------- communities
route("GET", "/community/communities", async ({ request }) => {
  const { user } = await requireAdult(request);
  const sql = await db();
  const rows =
    await sql`select c.id, c.slug, c.name, c.description, c.cover_hue, c.cover_id, c.premium,
      (select count(*) from community_members m where m.community_id = c.id)::int as members,
      (select count(*) from posts p where p.community_id = c.id and p.created_at > now() - interval '7 days' and p.status = 'visible')::int as posts_week,
      (select role from community_members m where m.community_id = c.id and m.user_id = ${user.id}) as my_role
    from communities c where c.status = 'active' order by members desc, c.name`;
  return { communities: rows, premium: await isPremium(user) };
});

route("POST", "/community/communities", async ({ request }) => {
  const { user } = await requireVerifiedAdult(request);
  rateLimit(`community-create:${user.id}`, 3, 24 * 60 * 60 * 1000);
  const input = await body(
    request,
    z.object({
      name: z.string().min(3).max(60),
      description: z.string().min(10).max(400),
      guidelines: z.string().max(2000).optional(),
      hue: z.number().int().min(0).max(360),
    }),
  );
  if (moderateText(`${input.name} ${input.description}`).action !== "allow")
    throw bad("Please choose a different name or description.");
  const slug =
    input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "community";
  const sql = await db();
  const exists = await sql`select 1 from communities where slug = ${slug}`;
  if (exists.length) throw bad("A community with that name already exists.");
  const owned = await sql`select count(*)::int as n from communities where created_by = ${user.id}`;
  if ((owned[0]?.["n"] as number) >= 5) throw bad("You can create up to 5 communities.");
  const [c] =
    await sql`insert into communities (slug, name, description, guidelines, cover_hue, created_by)
    values (${slug}, ${clean(input.name, 60)}, ${clean(input.description, 400)}, ${clean(input.guidelines ?? "", 2000)}, ${input.hue}, ${user.id}) returning id, slug`;
  await sql`insert into community_members (community_id, user_id, role) values (${c!["id"]}, ${user.id}, 'owner')`;
  return { slug: c!["slug"] };
});

route("GET", "/community/c/:slug", async ({ request, params }) => {
  const { user } = await requireAdult(request);
  const sql = await db();
  const [c] =
    await sql`select c.*, (select count(*) from community_members m where m.community_id = c.id)::int as members,
      (select role from community_members m where m.community_id = c.id and m.user_id = ${user.id}) as my_role
    from communities c where c.slug = ${params["slug"]!} and c.status = 'active'`;
  if (!c) throw notFound("Community not found.");
  if (c["premium"] && !(await isPremium(user)))
    return { community: { ...c, locked: true }, moderators: [] };
  const moderators =
    await sql`select u.community_alias as username, case when u.identity_mode = 'name' then u.display_name else u.community_alias end as display_name, m.role from community_members m join users u on u.id = m.user_id
    where m.community_id = ${c["id"]} and m.role in ('owner','moderator')`;
  return { community: c, moderators };
});

route("POST", "/community/c/:slug/join", async ({ request, params }) => {
  const { user } = await requireVerifiedAdult(request);
  const sql = await db();
  const [c] =
    await sql`select id, premium from communities where slug = ${params["slug"]!} and status = 'active'`;
  if (!c) throw notFound();
  if (c["premium"] && !(await isPremium(user)))
    throw forbidden("This is a Premium community.", "premium_required");
  await sql`insert into community_members (community_id, user_id) values (${c["id"]}, ${user.id}) on conflict do nothing`;
  return { ok: true };
});

route("POST", "/community/c/:slug/leave", async ({ request, params }) => {
  const { user } = await requireAdult(request);
  const sql = await db();
  await sql`delete from community_members where user_id = ${user.id} and role <> 'owner'
    and community_id = (select id from communities where slug = ${params["slug"]!})`;
  return { ok: true };
});

route("POST", "/community/c/:slug/moderators", async ({ request, params }) => {
  const { user } = await requireAdult(request);
  const { username, role } = await body(
    request,
    z.object({ username: z.string(), role: z.enum(["member", "moderator"]) }),
  );
  const sql = await db();
  const [c] =
    await sql`select c.id from communities c join community_members m on m.community_id = c.id
    where c.slug = ${params["slug"]!} and m.user_id = ${user.id} and m.role = 'owner'`;
  if (!c && user.role !== "admin")
    throw forbidden("Only the community owner can change moderators.");
  await sql`update community_members set role = ${role} where role <> 'owner'
    and community_id = (select id from communities where slug = ${params["slug"]!})
    and user_id = (select id from users where lower(community_alias) = ${username.toLowerCase()} and age_group = 'adult')`;
  return { ok: true };
});

// ---------------------------------------------------------------- profiles + follows
async function relationship(sql: Sql, me: string, them: string) {
  const [r] = await sql`select
    exists (select 1 from follows where follower_id = ${me} and followee_id = ${them}) as following,
    exists (select 1 from follows where follower_id = ${them} and followee_id = ${me}) as follows_me,
    exists (select 1 from blocks where blocker_id = ${me} and blocked_id = ${them}) as blocked,
    exists (select 1 from blocks where blocker_id = ${them} and blocked_id = ${me}) as blocked_me,
    exists (select 1 from mutes where muter_id = ${me} and muted_id = ${them}) as muted`;
  return r as {
    following: boolean;
    follows_me: boolean;
    blocked: boolean;
    blocked_me: boolean;
    muted: boolean;
  };
}

route("GET", "/community/u/:username", async ({ request, params }) => {
  const { user } = await requireAdult(request);
  const sql = await db();
  const [u] =
    await sql`select id, community_alias as username, case when identity_mode = 'name' then display_name else community_alias end as display_name,
      bio, case when identity_mode = 'name' then avatar_id end as avatar_id, cover_id, avatar_style, interests, profile_visibility, created_at, last_seen_at, prefs, identity_mode
    from users where lower(community_alias) = ${params["username"]!.toLowerCase()} and age_group = 'adult' and status = 'active'`;
  if (!u) throw notFound("Profile not found.");
  const rel = await relationship(sql, user.id, u["id"] as string);
  if (rel.blocked_me) throw notFound("Profile not found.");
  const isMe = u["id"] === user.id;
  const canSee =
    isMe ||
    u["profile_visibility"] === "public" ||
    (u["profile_visibility"] === "followers" && rel.following);
  const [counts] = await sql`select
    (select count(*) from follows where followee_id = ${u["id"]})::int as followers,
    (select count(*) from follows where follower_id = ${u["id"]})::int as following,
    (select count(*) from posts where author_id = ${u["id"]} and status = 'visible' and not anonymous)::int as posts`;
  const prefs = u["prefs"] as Record<string, unknown>;
  const online =
    prefs["showOnline"] === true &&
    u["last_seen_at"] &&
    Date.now() - (u["last_seen_at"] as Date).getTime() < 3 * 60000;
  const base = {
    id: u["id"],
    username: u["username"],
    displayName: u["display_name"],
    avatarId: u["avatar_id"],
    avatarStyle: u["avatar_style"],
    coverId: u["cover_id"],
    visibility: u["profile_visibility"],
    counts,
    rel,
    isMe,
    online: !!online,
    canSee,
  };
  if (!canSee) return { profile: base };
  const [communities, achievements, posts, garden] = await Promise.all([
    sql`select c.slug, c.name, c.cover_hue from community_members m join communities c on c.id = m.community_id where m.user_id = ${u["id"]} limit 12`,
    sql`select key, earned_at from user_achievements where user_id = ${u["id"]} order by earned_at desc limit 12`,
    sql`select ${postSelect(sql, user.id)} from posts p join users a on a.id = p.author_id left join communities c on c.id = p.community_id
      where p.author_id = ${u["id"]} and not p.anonymous and ${visibleTo(sql, user.id)} order by p.created_at desc limit 20`,
    sql`select
      (select count(*) from mood_entries where user_id = ${u["id"]})::int as checkins,
      (select count(*) from journal_entries where user_id = ${u["id"]})::int as journals,
      (select count(*) from activity_events where user_id = ${u["id"]})::int as activities,
      (select count(*) from game_results where user_id = ${u["id"]})::int as games`,
  ]);
  return {
    profile: {
      ...base,
      bio: u["bio"],
      interests: u["interests"],
      joined: u["created_at"],
      communities,
      achievements,
      garden: garden[0],
    },
    posts,
  };
});

route("GET", "/community/u/:username/:list", async ({ request, params }) => {
  const { user } = await requireAdult(request);
  if (params["list"] !== "followers" && params["list"] !== "following") throw notFound();
  const sql = await db();
  const [u] =
    await sql`select id, profile_visibility from users where lower(community_alias) = ${params["username"]!.toLowerCase()} and age_group = 'adult'`;
  if (!u) throw notFound();
  if (u["id"] !== user.id && u["profile_visibility"] === "private") return { users: [] };
  const rows =
    params["list"] === "followers"
      ? await sql`select u.community_alias as username, case when u.identity_mode = 'name' then u.display_name else u.community_alias end as display_name, case when u.identity_mode = 'name' then u.avatar_id end as avatar_id, u.avatar_style from follows f join users u on u.id = f.follower_id where f.followee_id = ${u["id"]} and u.status = 'active' limit 200`
      : await sql`select u.community_alias as username, case when u.identity_mode = 'name' then u.display_name else u.community_alias end as display_name, case when u.identity_mode = 'name' then u.avatar_id end as avatar_id, u.avatar_style from follows f join users u on u.id = f.followee_id where f.follower_id = ${u["id"]} and u.status = 'active' limit 200`;
  return { users: rows };
});

route("POST", "/community/users/:id/follow", async ({ request, params }) => {
  const { user } = await requireVerifiedAdult(request);
  rateLimit(`follow:${user.id}`, 100, 60 * 60 * 1000);
  const sql = await db();
  const them = params["id"]!;
  if (them === user.id) throw bad("You can't follow yourself.");
  const target =
    await sql`select id from users where id = ${them} and age_group = 'adult' and status = 'active'`;
  if (!target.length) throw notFound();
  const rel = await relationship(sql, user.id, them);
  if (rel.blocked || rel.blocked_me) throw forbidden("You can't follow this person.");
  if (rel.following) {
    await sql`delete from follows where follower_id = ${user.id} and followee_id = ${them}`;
    return { following: false };
  }
  await sql`insert into follows (follower_id, followee_id) values (${user.id}, ${them}) on conflict do nothing`;
  await notify(
    them,
    "community",
    `${publicName(user)} followed you`,
    "",
    `/u/${user.community_alias}`,
  );
  return { following: true };
});

route("POST", "/community/users/:id/block", async ({ request, params }) => {
  const { user } = await requireUser(request); // blocking is never paywalled or restricted
  const sql = await db();
  const them = params["id"]!;
  if (them === user.id) throw bad("You can't block yourself.");
  const del =
    await sql`delete from blocks where blocker_id = ${user.id} and blocked_id = ${them} returning blocked_id`;
  if (del.length) return { blocked: false };
  await sql`insert into blocks (blocker_id, blocked_id) values (${user.id}, ${them}) on conflict do nothing`;
  await sql`delete from follows where (follower_id = ${user.id} and followee_id = ${them}) or (follower_id = ${them} and followee_id = ${user.id})`;
  return { blocked: true };
});

route("POST", "/community/users/:id/mute", async ({ request, params }) => {
  const { user } = await requireUser(request);
  const sql = await db();
  const them = params["id"]!;
  const del =
    await sql`delete from mutes where muter_id = ${user.id} and muted_id = ${them} returning muted_id`;
  if (del.length) return { muted: false };
  await sql`insert into mutes (muter_id, muted_id) values (${user.id}, ${them}) on conflict do nothing`;
  return { muted: true };
});

route("GET", "/community/blocked", async ({ request }) => {
  const { user } = await requireUser(request);
  const sql = await db();
  const rows =
    await sql`select u.id, u.community_alias as username, u.community_alias as display_name, 'block' as kind from blocks b join users u on u.id = b.blocked_id where b.blocker_id = ${user.id}
    union all select u.id, u.community_alias, u.community_alias, 'mute' from mutes m join users u on u.id = m.muted_id where m.muter_id = ${user.id}`;
  return { users: rows };
});

// ---------------------------------------------------------------- reports (always free)
route("POST", "/reports", async ({ request }) => {
  const auth: Auth = await requireUser(request);
  rateLimit(`report:${auth.user.id}`, 30, 60 * 60 * 1000);
  const input = await body(
    request,
    z.object({
      targetKind: z.enum(["post", "comment", "user", "message", "community"]),
      targetId: z.string().uuid(),
      reason: z.enum([
        "harassment",
        "hate",
        "self_harm",
        "spam",
        "sexual",
        "violence",
        "misinformation",
        "privacy",
        "underage",
        "other",
      ]),
      details: z.string().max(1000).optional(),
    }),
  );
  const sql = await db();
  await sql`insert into reports (reporter_id, target_kind, target_id, reason, details)
    values (${auth.user.id}, ${input.targetKind}, ${input.targetId}, ${input.reason}, ${clean(input.details ?? "", 1000)})`;
  // Reports of possible self-harm or an underage user are escalated to staff immediately.
  if (input.reason === "self_harm" || input.reason === "underage") {
    const staff =
      await sql`select id from users where role in ('admin','moderator') and status = 'active'`;
    for (const s of staff)
      await notify(
        s["id"] as string,
        "moderation",
        `Urgent report: ${input.reason.replace("_", " ")}`,
        "",
        "/admin",
      );
  }
  return { ok: true };
});

// ---------------------------------------------------------------- search + discovery
route("GET", "/community/search", async ({ request, url }) => {
  const { user } = await requireAdult(request);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return { users: [], posts: [], communities: [] };
  const like = `%${q.replace(/[%_\\]/g, "")}%`;
  const sql = await db();
  const [users, posts, communities] = await Promise.all([
    sql`select u.id, u.community_alias as username, case when u.identity_mode = 'name' then u.display_name else u.community_alias end as display_name, case when u.identity_mode = 'name' then u.avatar_id end as avatar_id, u.avatar_style from users u
      where u.age_group = 'adult' and u.status = 'active' and u.profile_visibility <> 'private'
        and (u.community_alias ilike ${like} or (u.identity_mode = 'name' and u.display_name ilike ${like}))
        and not exists (select 1 from blocks b where b.blocker_id = u.id and b.blocked_id = ${user.id}) limit 10`,
    sql`select ${postSelect(sql, user.id)} from posts p join users a on a.id = p.author_id left join communities c on c.id = p.community_id
      where ${visibleTo(sql, user.id)} and p.search @@ plainto_tsquery('english', ${q}) order by p.created_at desc limit 15`,
    sql`select slug, name, description, cover_hue from communities where status = 'active' and (name ilike ${like} or description ilike ${like}) limit 8`,
  ]);
  return { users, posts, communities };
});

route("GET", "/community/discover", async ({ request }) => {
  const { user } = await requireAdult(request);
  const sql = await db();
  const [suggested, trending, recommended] = await Promise.all([
    sql`select u.id, u.community_alias as username, case when u.identity_mode = 'name' then u.display_name else u.community_alias end as display_name, case when u.identity_mode = 'name' then u.avatar_id end as avatar_id, u.avatar_style, u.interests from users u
      where u.age_group = 'adult' and u.status = 'active' and u.profile_visibility = 'public' and u.id <> ${user.id}
        and not exists (select 1 from follows f where f.follower_id = ${user.id} and f.followee_id = u.id)
        and not exists (select 1 from blocks b where (b.blocker_id = u.id and b.blocked_id = ${user.id}) or (b.blocker_id = ${user.id} and b.blocked_id = u.id))
      order by (u.interests && ${user.interests}) desc, (select count(*) from follows f where f.followee_id = u.id) desc limit 6`,
    sql`select lower(m[1]) as tag, count(*)::int as n from posts p, regexp_matches(p.body, '#([A-Za-z][A-Za-z0-9_]{1,30})', 'g') as m
      where p.status = 'visible' and p.created_at > now() - interval '7 days' group by 1 order by 2 desc limit 8`,
    sql`select c.slug, c.name, c.description, c.cover_hue, (select count(*) from community_members m where m.community_id = c.id)::int as members
      from communities c where c.status = 'active' and not c.premium
        and not exists (select 1 from community_members m where m.community_id = c.id and m.user_id = ${user.id})
      order by members desc limit 4`,
  ]);
  return { suggested, trending, recommended, prompt: todaysPrompt() };
});

export { publish };
