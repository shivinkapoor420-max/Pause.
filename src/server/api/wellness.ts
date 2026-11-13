import { z } from "zod";
import { db } from "../db";
import {
  SESSION_COOKIE,
  audit,
  cookie,
  generateAlias,
  requireUser,
  selfView,
  type UserRow,
} from "../auth";
import { verifyPassword } from "../crypto";
import { bad, body, clean, clientIp, forbidden, json, rateLimit } from "../http";
import { route } from "../router";
import { achievementCatalog, awardXp, checkAchievements, isPremium } from "../services";

const sky = z.enum(["sunny", "partly", "cloudy", "rainy", "stormy"]);

function toDay(d: Date | string) {
  return typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10);
}

/** Everything the app needs on load, in the shape the client AppState uses. */
route("GET", "/me/state", async ({ request }) => {
  const { user } = await requireUser(request);
  const sql = await db();
  const [moods, journal, checkins, companion, tools, grounding] = await Promise.all([
    sql`select day, sky, tags from mood_entries where user_id = ${user.id} order by day desc limit 400`,
    sql`select id, created_at, kind, prompt, body, sky from journal_entries where user_id = ${user.id} order by created_at desc limit 300`,
    sql`select id, created_at, band, answers, flagged from checkins where user_id = ${user.id} order by created_at desc limit 200`,
    sql`select id, created_at, band, mode, turns, observations from companion_sessions where user_id = ${user.id} order by created_at desc limit 60`,
    sql`select ref, count(*)::int as n from activity_events where user_id = ${user.id} and kind = 'tool' group by ref`,
    sql`select created_at, meta from activity_events where user_id = ${user.id} and kind = 'grounding' order by created_at desc limit 200`,
  ]);
  const toolUse: Record<string, number> = {};
  for (const t of tools) toolUse[t["ref"] as string] = t["n"] as number;
  toolUse["grounding"] = grounding.length;
  return {
    moods: moods
      .reverse()
      .map((m) => ({ date: toDay(m["day"] as Date), sky: m["sky"], tags: m["tags"] })),
    journal: journal.map((j) => ({
      id: j["id"],
      date: (j["created_at"] as Date).toISOString(),
      kind: j["kind"],
      prompt: j["prompt"],
      body: j["body"],
      sky: j["sky"] ?? undefined,
    })),
    checkins: checkins.map((c) => ({
      id: c["id"],
      date: (c["created_at"] as Date).toISOString(),
      band: c["band"],
      answers: c["answers"],
      flagged: c["flagged"],
    })),
    companion: companion.map((c) => ({
      id: c["id"],
      date: (c["created_at"] as Date).toISOString(),
      band: c["band"],
      mode: c["mode"],
      turns: c["turns"],
      observations: c["observations"],
    })),
    toolUse,
    groundingSessions: grounding
      .reverse()
      .map((g) => ({ at: (g["created_at"] as Date).toISOString(), ...(g["meta"] as object) })),
    appData: user.app_data,
    riskFlagged: checkins.some(
      (c) => c["flagged"] && Date.now() - (c["created_at"] as Date).getTime() < 14 * 86400000,
    ),
  };
});

route("PATCH", "/me", async ({ request }) => {
  const { user } = await requireUser(request);
  const input = await body(
    request,
    z.object({
      displayName: z.string().min(1).max(60).optional(),
      bio: z.string().max(400).optional(),
      phone: z.string().max(24).optional(),
      interests: z.array(z.string().max(30)).max(12).optional(),
      avatarStyle: z.string().max(30).optional(),
      avatarId: z.string().uuid().nullable().optional(),
      coverId: z.string().uuid().nullable().optional(),
      profileVisibility: z.enum(["public", "followers", "private"]).optional(),
      settings: z.record(z.unknown()).optional(),
      prefs: z
        .object({
          notifyMessages: z.boolean(),
          notifyCommunity: z.boolean(),
          notifyAchievements: z.boolean(),
          notifyReminders: z.boolean(),
          notifyFamily: z.boolean(),
          readReceipts: z.boolean(),
          showOnline: z.boolean(),
          leaderboardOptIn: z.boolean(),
          leaderboardAlias: z.string().max(24),
          theme: z.string().max(20),
          reminderTime: z.string().regex(/^\d{2}:\d{2}$/),
          tz: z.string().max(60),
          emailReminders: z.boolean(),
        })
        .partial()
        .optional(),
      appData: z.record(z.unknown()).optional(),
      memoryConsent: z.boolean().optional(),
      identityMode: z.enum(["alias", "name"]).optional(),
      newAlias: z.boolean().optional(),
    }),
  );
  if (input.appData && JSON.stringify(input.appData).length > 200_000)
    throw bad("That's too much data to save.");
  if (input.settings && JSON.stringify(input.settings).length > 5_000)
    throw bad("Settings too large.");
  // Minors keep private profiles; no social surface exists for them anyway.
  const visibility = user.age_group === "adult" ? input.profileVisibility : "private";
  if (input.prefs?.leaderboardOptIn && user.age_group !== "adult")
    throw forbidden("Leaderboards are for adult members.");
  const sql = await db();
  const [u] = await sql<UserRow[]>`update users set
      display_name = ${input.displayName ? clean(input.displayName, 60) : user.display_name},
      bio = ${input.bio !== undefined ? clean(input.bio, 400) : user.bio},
      phone = ${input.phone !== undefined ? clean(input.phone, 24) : user.phone},
      interests = ${input.interests ? input.interests.map((i) => clean(i, 30)).filter(Boolean) : user.interests},
      avatar_style = ${input.avatarStyle ?? user.avatar_style},
      avatar_id = ${input.avatarId !== undefined ? input.avatarId : user.avatar_id},
      cover_id = ${input.coverId !== undefined ? input.coverId : user.cover_id},
      profile_visibility = ${visibility ?? user.profile_visibility},
      settings = settings || ${sql.json((input.settings ?? {}) as never)},
      prefs = prefs || ${sql.json((input.prefs ?? {}) as never)},
      app_data = app_data || ${sql.json((input.appData ?? {}) as never)},
      memory_consent = ${input.memoryConsent ?? user.memory_consent},
      identity_mode = ${input.identityMode ?? user.identity_mode},
      community_alias = ${input.newAlias && user.age_group === "adult" ? generateAlias() : user.community_alias},
      updated_at = now()
    where id = ${user.id} returning *`;
  if (input.memoryConsent !== undefined) {
    await sql`insert into consents (user_id, kind, granted) values (${user.id}, 'ai_memory', ${input.memoryConsent})`;
  }
  return { user: selfView(u!) };
});

route("POST", "/moods", async ({ request }) => {
  const auth = await requireUser(request);
  const input = await body(
    request,
    z.object({
      sky,
      tags: z.array(z.string().max(40)).max(12),
      note: z.string().max(1000).optional(),
    }),
  );
  const sql = await db();
  await sql`insert into mood_entries (user_id, day, sky, tags, note, assisted_by)
    values (${auth.user.id}, current_date, ${input.sky}, ${input.tags}, ${clean(input.note ?? "", 1000)}, ${auth.childMode ? auth.parentId : null})
    on conflict (user_id, day) do update set sky = excluded.sky, tags = excluded.tags, note = excluded.note`;
  // XP for showing up — identical whatever the weather.
  await awardXp(auth.user.id, 10, "checkin");
  await checkAchievements(auth.user.id);
  return { ok: true };
});

route("POST", "/journal", async ({ request }) => {
  const { user } = await requireUser(request);
  rateLimit(`journal:${user.id}`, 60, 60 * 60 * 1000);
  const input = await body(
    request,
    z.object({
      kind: z.enum(["text", "voice", "drawing", "gratitude"]),
      prompt: z.string().max(400),
      body: z.string().max(1_500_000),
      sky: sky.optional(),
    }),
  );
  const media = input.kind === "drawing" || input.kind === "voice";
  if (!media && input.body.length > 20000) throw bad("That entry is too long.");
  if (
    input.kind === "drawing" &&
    !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(input.body)
  )
    throw bad("Drawing must be an image.");
  if (
    input.kind === "voice" &&
    !/^data:audio\/(webm|ogg|mp4|mpeg)(;codecs=[a-z0-9.,]+)?;base64,[A-Za-z0-9+/=]+$/.test(
      input.body,
    )
  )
    throw bad("Voice note must be an audio recording.");
  const controls = (user.prefs["controls"] as { journal?: boolean } | undefined) ?? {};
  if (user.guardian_id && controls.journal === false)
    throw forbidden("Journaling is switched off for this profile.");
  const sql = await db();
  const [row] = await sql`insert into journal_entries (user_id, kind, prompt, body, sky)
    values (${user.id}, ${input.kind}, ${clean(input.prompt, 400)}, ${media ? input.body : clean(input.body, 20000)}, ${input.sky ?? null})
    returning id, created_at`;
  await awardXp(user.id, 10, "journal");
  await checkAchievements(user.id);
  return { id: row!["id"], date: (row!["created_at"] as Date).toISOString() };
});

route("GET", "/journal", async ({ request, url }) => {
  const { user } = await requireUser(request);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const sql = await db();
  const rows = q
    ? await sql`select id, created_at, kind, prompt, body, sky from journal_entries where user_id = ${user.id} and kind <> 'drawing'
        and (body ilike ${"%" + q.replace(/[%_]/g, "") + "%"} or prompt ilike ${"%" + q.replace(/[%_]/g, "") + "%"}) order by created_at desc limit 50`
    : await sql`select id, created_at, kind, prompt, body, sky from journal_entries where user_id = ${user.id} order by created_at desc limit 100`;
  return { entries: rows };
});

route("DELETE", "/journal/:id", async ({ request, params }) => {
  const { user } = await requireUser(request);
  const sql = await db();
  await sql`delete from journal_entries where id = ${params["id"]!} and user_id = ${user.id}`;
  return { ok: true };
});

route("POST", "/checkins", async ({ request }) => {
  const auth = await requireUser(request);
  const input = await body(
    request,
    z.object({ band: z.string().max(10), answers: z.record(z.number()), flagged: z.boolean() }),
  );
  const sql = await db();
  const [row] =
    await sql`insert into checkins (user_id, band, answers, flagged) values (${auth.user.id}, ${input.band}, ${sql.json(input.answers as never)}, ${input.flagged}) returning id`;
  if (input.flagged && auth.user.guardian_id) {
    const { notify } = await import("../services");
    // Safety alerts always reach the guardian — whatever the teen privacy setting.
    await notify(
      auth.user.guardian_id,
      "family",
      `Please check in with ${auth.user.display_name} today`,
      "A recent check-in suggested they may be struggling. Crisis resources are on the Family page.",
      "/family",
    );
  }
  return { id: row!["id"] };
});

route("POST", "/companion/sessions", async ({ request }) => {
  const { user } = await requireUser(request);
  const input = await body(
    request,
    z.object({ id: z.string().uuid(), band: z.string().max(10), mode: z.enum(["voice", "text"]) }),
  );
  const sql = await db();
  await sql`insert into companion_sessions (id, user_id, band, mode) values (${input.id}, ${user.id}, ${input.band}, ${input.mode}) on conflict do nothing`;
  return { ok: true };
});

route("PATCH", "/companion/sessions/:id", async ({ request, params }) => {
  const { user } = await requireUser(request);
  const input = await body(
    request,
    z.object({
      turns: z.array(z.record(z.unknown())).max(400),
      observations: z.array(z.record(z.unknown())).max(400),
    }),
  );
  const sql = await db();
  // Transcripts are only retained when the person has opted in to Pip remembering.
  const turns = user.memory_consent || user.age_group !== "adult" ? input.turns : [];
  await sql`update companion_sessions set turns = ${sql.json(turns as never)}, observations = ${sql.json(input.observations as never)}
    where id = ${params["id"]!} and user_id = ${user.id}`;
  await awardXp(user.id, 5, "companion");
  return { ok: true };
});

route("DELETE", "/companion/sessions", async ({ request }) => {
  const { user } = await requireUser(request);
  const sql = await db();
  await sql`delete from companion_sessions where user_id = ${user.id}`;
  return { ok: true };
});

route("POST", "/activity", async ({ request }) => {
  const { user } = await requireUser(request);
  rateLimit(`activity:${user.id}`, 120, 60 * 60 * 1000);
  const input = await body(
    request,
    z.object({
      kind: z.enum([
        "tool",
        "grounding",
        "breathing",
        "story",
        "colouring",
        "routine",
        "meditation",
        "sleep",
      ]),
      ref: z.string().max(60),
      meta: z.record(z.unknown()).optional(),
    }),
  );
  const sql = await db();
  await sql`insert into activity_events (user_id, kind, ref, meta) values (${user.id}, ${input.kind}, ${input.ref}, ${sql.json((input.meta ?? {}) as never)})`;
  await awardXp(user.id, 8, input.kind);
  await checkAchievements(user.id);
  return { ok: true };
});

// ---------------------------------------------------------------- insights
route("GET", "/insights", async ({ request, url }) => {
  const { user } = await requireUser(request);
  const premium = await isPremium(user);
  const range =
    url.searchParams.get("range") === "month"
      ? 30
      : url.searchParams.get("range") === "year"
        ? 365
        : 7;
  if (range > 30 && !premium)
    throw forbidden("Year-long insights are part of Premium.", "premium_required");
  const sql = await db();
  const days =
    await sql`select day, sky, tags from mood_entries where user_id = ${user.id} and day > current_date - ${range}::int order by day`;
  const activity =
    await sql`select date_trunc('day', created_at)::date as day, count(*)::int as n from activity_events
    where user_id = ${user.id} and created_at > now() - ${`${range} days`}::interval group by 1 order by 1`;
  const tagCounts: Record<string, number> = {};
  for (const d of days)
    for (const t of d["tags"] as string[]) tagCounts[t] = (tagCounts[t] ?? 0) + 1;
  const skyScore: Record<string, number> = { sunny: 5, partly: 4, cloudy: 3, rainy: 2, stormy: 1 };
  const advanced = premium
    ? {
        // Which activities tend to sit alongside lighter days — an observation, never a prescription.
        topTags: Object.entries(tagCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6),
        weekdayPattern: [0, 1, 2, 3, 4, 5, 6].map((wd) => {
          const list = days.filter((d) => new Date(d["day"] as Date).getUTCDay() === wd);
          return list.length
            ? list.reduce((a, d) => a + skyScore[d["sky"] as string]!, 0) / list.length
            : null;
        }),
      }
    : null;
  return {
    range,
    premium,
    moods: days.map((d) => ({
      day: toDay(d["day"] as Date),
      sky: d["sky"],
      score: skyScore[d["sky"] as string],
    })),
    activity: activity.map((a) => ({ day: toDay(a["day"] as Date), n: a["n"] })),
    advanced,
  };
});

// ---------------------------------------------------------------- achievements + xp
route("GET", "/achievements", async ({ request }) => {
  const { user } = await requireUser(request);
  const premium = await isPremium(user);
  const sql = await db();
  const earned = await sql`select key, earned_at from user_achievements where user_id = ${user.id}`;
  const [xp] = await sql`select coalesce(sum(amount),0)::int as total,
    coalesce(sum(amount) filter (where day = current_date),0)::int as today from xp_ledger where user_id = ${user.id}`;
  const total = (xp?.["total"] as number) ?? 0;
  const map = new Map(earned.map((e) => [e["key"] as string, e["earned_at"]]));
  return {
    xp: total,
    xpToday: xp?.["today"] ?? 0,
    level: Math.floor(Math.sqrt(total / 50)) + 1,
    achievements: Object.entries(achievementCatalog)
      .filter(([, a]) => !a.premium || premium)
      .map(([key, a]) => ({ key, ...a, earnedAt: map.get(key) ?? null })),
  };
});

// ---------------------------------------------------------------- data rights
route("GET", "/me/export", async ({ request }) => {
  const { user } = await requireUser(request);
  rateLimit(`export:${user.id}`, 5, 60 * 60 * 1000);
  const sql = await db();
  const [moods, journal, checkins, companion, games, posts, comments, messages, consents] =
    await Promise.all([
      sql`select day, sky, tags, note, created_at from mood_entries where user_id = ${user.id}`,
      sql`select kind, prompt, body, sky, created_at from journal_entries where user_id = ${user.id}`,
      sql`select band, answers, flagged, created_at from checkins where user_id = ${user.id}`,
      sql`select mode, turns, observations, created_at from companion_sessions where user_id = ${user.id}`,
      sql`select game, difficulty, score, duration_s, created_at from game_results where user_id = ${user.id}`,
      sql`select body, anonymous, created_at from posts where author_id = ${user.id}`,
      sql`select body, created_at from comments where author_id = ${user.id}`,
      sql`select body, kind, created_at from messages where sender_id = ${user.id} and deleted_at is null`,
      sql`select kind, granted, version, created_at from consents where user_id = ${user.id}`,
    ]);
  const data = {
    exportedAt: new Date().toISOString(),
    profile: selfView(user),
    moods,
    journal,
    checkins,
    companion,
    games,
    posts,
    comments,
    messages,
    consents,
  };
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="pause-export-${user.username}.json"`,
    },
  });
});

route("POST", "/me/delete", async ({ request }) => {
  const auth = await requireUser(request);
  if (auth.childMode) throw forbidden();
  const { password } = await body(request, z.object({ password: z.string() }));
  if (!(await verifyPassword(password, auth.user.password_hash)))
    throw bad("Your password isn't right.");
  const sql = await db();
  if (auth.user.role === "admin") {
    const admins =
      await sql`select count(*)::int as n from users where role = 'admin' and status = 'active'`;
    if ((admins[0]?.["n"] as number) <= 1)
      throw bad("You're the only administrator — promote someone else first.");
  }
  await audit(auth.user.id, "account.delete", auth.user.id, {}, clientIp(request));
  await sql`delete from users where id = ${auth.user.id}`; // cascades: child profiles, entries, posts, messages
  return json({ ok: true }, { headers: { "set-cookie": cookie(SESSION_COOKIE, "", 0) } });
});

/** Today's gentle quests — activity-based only, never mood-based. */
route("GET", "/me/today", async ({ request }) => {
  const { user } = await requireUser(request);
  const sql = await db();
  const [t] = await sql`select
    exists (select 1 from mood_entries where user_id = ${user.id} and day = current_date) as checked_in,
    exists (select 1 from journal_entries where user_id = ${user.id} and created_at > current_date) as journaled,
    exists (select 1 from activity_events where user_id = ${user.id} and kind in ('breathing','grounding','tool','meditation','sleep') and created_at > current_date) as breathed,
    exists (select 1 from game_results where user_id = ${user.id} and created_at > current_date) as played,
    (select coalesce(sum(amount),0) from xp_ledger where user_id = ${user.id})::int as xp,
    (select count(distinct day) from mood_entries where user_id = ${user.id})::int as days_showed_up`;
  const xp = (t?.["xp"] as number) ?? 0;
  const level = Math.floor(Math.sqrt(xp / 50)) + 1;
  const thisLevel = 50 * (level - 1) ** 2;
  const nextLevel = 50 * level ** 2;
  return {
    ...t,
    level,
    progress: (xp - thisLevel) / (nextLevel - thisLevel),
    nextLevelXp: nextLevel,
  };
});

/** Gentle journal prompt for teens/adults. Uses AI if configured; never sends journal text — only recent mood tags. */
const curatedPrompts: Record<string, string[]> = {
  bright: [
    "What made today feel lighter? How could you invite more of it?",
    "Who would you like to thank today, and for what?",
  ],
  okay: [
    "What's one thing you handled well this week?",
    "What does 'enough' look like for you today?",
  ],
  low: [
    "What would you say to a friend feeling exactly like this?",
    "What's one tiny thing that might help, even 2% ?",
  ],
  stormy: [
    "Name what's loudest right now. Then name one thing that's steady.",
    "What do you need most in the next hour — rest, company, space or comfort?",
  ],
};
route("GET", "/journal/suggest", async ({ request }) => {
  const { user } = await requireUser(request);
  const sql = await db();
  const recent =
    await sql`select sky, tags from mood_entries where user_id = ${user.id} order by day desc limit 3`;
  const sky = (recent[0]?.["sky"] as string) ?? "partly";
  const bucket =
    sky === "sunny"
      ? "bright"
      : sky === "partly" || sky === "cloudy"
        ? "okay"
        : sky === "rainy"
          ? "low"
          : "stormy";
  const fallback = () => {
    const list = curatedPrompts[bucket]!;
    return list[Math.floor(Math.random() * list.length)]!;
  };
  if (user.age_group === "early" || user.age_group === "kids") return { prompt: fallback() };
  const { aiModel } = await import("../ai");
  const model = aiModel();
  if (!model) return { prompt: fallback() };
  try {
    const { generateText } = await import("ai");
    const tags = [...new Set(recent.flatMap((r) => r["tags"] as string[]))].slice(0, 6).join(", ");
    const { text } = await generateText({
      model,
      maxOutputTokens: 60,
      system:
        "Write ONE gentle, open journaling prompt (max 20 words) for a wellness app. No diagnosis, no advice, no therapy language. Output only the prompt.",
      prompt: `Recent mood: ${sky}. Words they tagged: ${tags || "none"}. ${user.age_group === "teen" ? "They are a teenager." : ""}`,
    });
    const p = text
      .trim()
      .replace(/^["']|["']$/g, "")
      .slice(0, 200);
    return { prompt: p || fallback() };
  } catch {
    return { prompt: fallback() };
  }
});
