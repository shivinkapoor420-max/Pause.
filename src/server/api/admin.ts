import { z } from "zod";
import { db } from "../db";
import { audit, requireAdmin, requireStaff } from "../auth";
import { bad, body, clientIp, notFound } from "../http";
import { route } from "../router";
import { notify } from "../services";
import { games } from "@/lib/games-catalog";

/** Platform-owner dashboard. Every route requires the admin (or moderator) role, checked server-side. */

route("GET", "/admin/overview", async ({ request }) => {
  await requireAdmin(request);
  const sql = await db();
  const [totals] = await sql`select
    (select count(*) from users where status <> 'deleted')::int as users,
    (select count(*) from users where last_seen_at > now() - interval '1 day')::int as active_day,
    (select count(*) from users where last_seen_at > now() - interval '7 days')::int as active_week,
    (select count(*) from users where created_at > now() - interval '7 days')::int as new_week,
    (select count(*) from users where status = 'suspended')::int as suspended,
    (select count(*) from subscriptions where status in ('active','trialing','past_due') and (current_period_end is null or current_period_end > now()))::int as premium,
    (select count(*) from subscriptions where status = 'past_due')::int as past_due,
    (select count(*) from reports where status = 'open')::int as open_reports,
    (select count(*) from contact_messages where status = 'new')::int as new_contact,
    (select count(*) from posts where created_at > now() - interval '7 days')::int as posts_week,
    (select count(*) from messages where created_at > now() - interval '7 days')::int as messages_week,
    (select coalesce(sum(amount_cents),0) from billing_events where kind = 'payment_succeeded' and created_at > now() - interval '30 days')::int as revenue_30d_cents,
    (select coalesce(sum(amount_cents),0) from billing_events where kind = 'payment_succeeded' and provider <> 'sandbox' and created_at > now() - interval '30 days')::int as live_revenue_30d_cents`;
  const ages = await sql`select age_group, count(*)::int as n from users where status <> 'deleted' group by 1`;
  const plans = await sql`select plan, provider, count(*)::int as n from subscriptions where status in ('active','trialing','past_due') group by 1, 2`;
  const signups = await sql`select date_trunc('day', created_at)::date as day, count(*)::int as n from users where created_at > now() - interval '30 days' group by 1 order by 1`;
  const engagement = await sql`select kind, count(*)::int as n from activity_events where created_at > now() - interval '30 days' group by 1 order by 2 desc`;
  const topGames = await sql`select game, count(*)::int as n from game_results where created_at > now() - interval '30 days' group by 1 order by 2 desc`;
  return { totals, ages, plans, signups, engagement, topGames };
});

route("GET", "/admin/users", async ({ request, url }) => {
  await requireAdmin(request);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  const like = `%${q.replace(/[%_\\]/g, "")}%`;
  const sql = await db();
  const rows = await sql`select u.id, u.email, u.username, u.community_alias, u.display_name, u.age_group, u.role, u.status, u.created_at, u.last_seen_at,
      u.guardian_id, (u.email_verified_at is not null) as verified,
      exists (select 1 from subscriptions s where s.user_id = u.id and s.status in ('active','trialing','past_due')) as premium,
      (select count(*) from reports r where r.target_kind = 'user' and r.target_id = u.id)::int as reports
    from users u where ${q ? sql`(u.email ilike ${like} or u.username ilike ${like} or u.community_alias ilike ${like} or u.display_name ilike ${like})` : sql`true`}
    order by u.created_at desc limit 100`;
  return { users: rows };
});

route("PATCH", "/admin/users/:id", async ({ request, params }) => {
  const auth = await requireAdmin(request);
  const input = await body(request, z.object({ role: z.enum(["user", "moderator", "admin"]).optional(), status: z.enum(["active", "suspended"]).optional(), note: z.string().max(500).optional() }));
  const sql = await db();
  const [u] = await sql`select id, age_group, role from users where id = ${params["id"]!}`;
  if (!u) throw notFound();
  if (u["id"] === auth.user.id && (input.role && input.role !== "admin")) throw bad("You can't remove your own admin role.");
  if (input.role && input.role !== "user" && u["age_group"] !== "adult") throw bad("Only adults can be staff.");
  await sql`update users set role = coalesce(${input.role ?? null}, role), status = coalesce(${input.status ?? null}, status), updated_at = now() where id = ${u["id"]}`;
  if (input.status === "suspended") await sql`delete from sessions where user_id = ${u["id"]}`;
  await sql`insert into moderation_actions (actor_id, target_kind, target_id, action, note) values (${auth.user.id}, 'user', ${u["id"]}, ${`set ${JSON.stringify(input)}`}, ${input.note ?? ""})`;
  await audit(auth.user.id, "admin.user.update", u["id"] as string, input, clientIp(request));
  return { ok: true };
});

route("GET", "/admin/reports", async ({ request, url }) => {
  await requireStaff(request);
  const status = url.searchParams.get("status") ?? "open";
  const sql = await db();
  const rows = await sql`select r.*, rep.community_alias as reporter,
      case r.target_kind
        when 'post' then (select json_build_object('body', p.body, 'status', p.status, 'author', a.community_alias, 'authorId', a.id, 'anonymous', p.anonymous) from posts p join users a on a.id = p.author_id where p.id = r.target_id)
        when 'comment' then (select json_build_object('body', c.body, 'status', c.status, 'author', a.community_alias, 'authorId', a.id) from comments c join users a on a.id = c.author_id where c.id = r.target_id)
        when 'message' then (select json_build_object('body', m.body, 'author', a.community_alias, 'authorId', a.id) from messages m join users a on a.id = m.sender_id where m.id = r.target_id)
        when 'user' then (select json_build_object('body', a.bio, 'author', a.community_alias, 'authorId', a.id, 'status', a.status, 'ageGroup', a.age_group) from users a where a.id = r.target_id)
        when 'community' then (select json_build_object('body', c.description, 'author', c.name) from communities c where c.id = r.target_id)
      end as target
    from reports r left join users rep on rep.id = r.reporter_id
    where r.status = ${status} order by (r.reason in ('self_harm','underage')) desc, r.created_at desc limit 100`;
  return { reports: rows };
});

route("POST", "/admin/reports/:id", async ({ request, params }) => {
  const auth = await requireStaff(request);
  const input = await body(request, z.object({ action: z.enum(["dismiss", "remove_content", "restore_content", "suspend_user", "warn_user"]), note: z.string().max(500).optional() }));
  const sql = await db();
  const [r] = await sql`select * from reports where id = ${params["id"]!}`;
  if (!r) throw notFound();
  const kind = r["target_kind"] as string;
  const target = r["target_id"] as string;
  let authorId: string | null = null;
  if (kind === "post") authorId = ((await sql`select author_id from posts where id = ${target}`)[0]?.["author_id"] as string) ?? null;
  if (kind === "comment") authorId = ((await sql`select author_id from comments where id = ${target}`)[0]?.["author_id"] as string) ?? null;
  if (kind === "message") authorId = ((await sql`select sender_id from messages where id = ${target}`)[0]?.["sender_id"] as string) ?? null;
  if (kind === "user") authorId = target;

  if (input.action === "remove_content") {
    if (kind === "post") await sql`update posts set status = 'removed' where id = ${target}`;
    if (kind === "comment") await sql`update comments set status = 'removed' where id = ${target}`;
    if (kind === "message") await sql`update messages set deleted_at = now(), body = '' where id = ${target}`;
    if (kind === "community") await sql`update communities set status = 'archived' where id = ${target}`;
    if (authorId) await notify(authorId, "moderation", "Something you shared was removed", "It didn't meet our community guidelines. Reply via Contact Us if you think this was a mistake.", "/community/guidelines");
  }
  if (input.action === "restore_content") {
    if (kind === "post") await sql`update posts set status = 'visible' where id = ${target}`;
    if (kind === "comment") await sql`update comments set status = 'visible' where id = ${target}`;
  }
  if (input.action === "suspend_user" && authorId) {
    if (auth.user.role !== "admin") throw bad("Only admins can suspend accounts.");
    await sql`update users set status = 'suspended' where id = ${authorId} and role <> 'admin'`;
    await sql`delete from sessions where user_id = ${authorId}`;
  }
  if (input.action === "warn_user" && authorId) {
    await notify(authorId, "moderation", "A note from the Pause moderators", input.note || "Please review our community guidelines — continued breaches may lead to suspension.", "/community/guidelines");
  }
  await sql`update reports set status = ${input.action === "dismiss" || input.action === "restore_content" ? "dismissed" : "actioned"}, resolved_by = ${auth.user.id}, resolved_at = now()
    where target_kind = ${kind} and target_id = ${target} and status = 'open'`;
  await sql`insert into moderation_actions (actor_id, target_kind, target_id, action, note) values (${auth.user.id}, ${kind}, ${target}, ${input.action}, ${input.note ?? ""})`;
  await audit(auth.user.id, `moderation.${input.action}`, `${kind}:${target}`, {}, clientIp(request));
  return { ok: true };
});

route("GET", "/admin/communities", async ({ request }) => {
  await requireStaff(request);
  const sql = await db();
  const rows = await sql`select c.id, c.slug, c.name, c.status, c.premium, c.created_at,
      (select count(*) from community_members m where m.community_id = c.id)::int as members,
      (select count(*) from posts p where p.community_id = c.id)::int as posts
    from communities c order by c.created_at`;
  return { communities: rows };
});

route("PATCH", "/admin/communities/:id", async ({ request, params }) => {
  const auth = await requireAdmin(request);
  const input = await body(request, z.object({ status: z.enum(["active", "archived"]).optional(), premium: z.boolean().optional(), name: z.string().min(3).max(60).optional(), description: z.string().max(400).optional() }));
  const sql = await db();
  await sql`update communities set status = coalesce(${input.status ?? null}, status), premium = coalesce(${input.premium ?? null}, premium),
    name = coalesce(${input.name ?? null}, name), description = coalesce(${input.description ?? null}, description) where id = ${params["id"]!}`;
  await audit(auth.user.id, "admin.community.update", params["id"]!, input, clientIp(request));
  return { ok: true };
});

route("POST", "/admin/communities", async ({ request }) => {
  const auth = await requireAdmin(request);
  const input = await body(request, z.object({ name: z.string().min(3).max(60), description: z.string().max(400), premium: z.boolean(), hue: z.number().int().min(0).max(360) }));
  const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  const sql = await db();
  await sql`insert into communities (slug, name, description, premium, cover_hue, created_by, guidelines)
    values (${slug}, ${input.name}, ${input.description}, ${input.premium}, ${input.hue}, ${auth.user.id}, (select guidelines from communities order by created_at limit 1))`;
  await audit(auth.user.id, "admin.community.create", slug, {}, clientIp(request));
  return { ok: true };
});

route("GET", "/admin/contact", async ({ request }) => {
  await requireAdmin(request);
  const sql = await db();
  const rows = await sql`select * from contact_messages order by (status = 'new') desc, created_at desc limit 200`;
  return { messages: rows };
});

route("PATCH", "/admin/contact/:id", async ({ request, params }) => {
  const auth = await requireAdmin(request);
  const { status } = await body(request, z.object({ status: z.enum(["new", "read", "replied", "archived"]) }));
  const sql = await db();
  await sql`update contact_messages set status = ${status} where id = ${params["id"]!}`;
  await audit(auth.user.id, "admin.contact.update", params["id"]!, { status }, clientIp(request));
  return { ok: true };
});

route("GET", "/admin/games", async ({ request }) => {
  await requireAdmin(request);
  const sql = await db();
  const overrides = await sql`select id, enabled, premium from games_catalog`;
  const plays = await sql`select game, count(*)::int as n from game_results group by 1`;
  const o = new Map(overrides.map((r) => [r["id"], r]));
  const p = new Map(plays.map((r) => [r["game"], r["n"]]));
  return { games: games.map((g) => ({ id: g.id, title: g.title, emoji: g.emoji, ages: g.ages, enabled: o.get(g.id)?.["enabled"] ?? true, premium: o.get(g.id)?.["premium"] ?? g.premium, plays: p.get(g.id) ?? 0 })) };
});

route("PATCH", "/admin/games/:game", async ({ request, params }) => {
  const auth = await requireAdmin(request);
  const input = await body(request, z.object({ enabled: z.boolean(), premium: z.boolean() }));
  if (!games.some((g) => g.id === params["game"])) throw notFound();
  const sql = await db();
  await sql`insert into games_catalog (id, enabled, premium) values (${params["game"]!}, ${input.enabled}, ${input.premium})
    on conflict (id) do update set enabled = excluded.enabled, premium = excluded.premium, updated_at = now()`;
  await audit(auth.user.id, "admin.game.update", params["game"]!, input, clientIp(request));
  return { ok: true };
});

route("GET", "/admin/subscriptions", async ({ request }) => {
  await requireAdmin(request);
  const sql = await db();
  const rows = await sql`select s.plan, s.status, s.provider, s.current_period_end, s.cancel_at_period_end, s.created_at, u.email, u.username
    from subscriptions s join users u on u.id = s.user_id order by s.updated_at desc limit 200`;
  return { subscriptions: rows };
});

route("GET", "/admin/audit", async ({ request }) => {
  await requireAdmin(request);
  const sql = await db();
  const rows = await sql`select l.action, l.target, l.meta, l.ip, l.created_at, u.username as actor from audit_logs l left join users u on u.id = l.actor_id order by l.created_at desc limit 200`;
  return { logs: rows };
});
