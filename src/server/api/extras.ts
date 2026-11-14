import { z } from "zod";
import { db } from "../db";
import { audit, publicName, requireAdmin, requireUser } from "../auth";
import { bad, body, clean, clientIp, forbidden, notFound, rateLimit } from "../http";
import { route } from "../router";
import { appUrl, notify, sendEmail } from "../services";
import { vapid } from "../push";

// ================================================================= push notifications
route("GET", "/push/key", async () => ({ publicKey: (await vapid()).publicKey }));

route("POST", "/push/subscribe", async ({ request }) => {
  const auth = await requireUser(request);
  if (auth.childMode) throw forbidden();
  const input = await body(
    request,
    z.object({
      endpoint: z.string().url().max(1000),
      keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }),
    }),
  );
  if (!input.endpoint.startsWith("https://")) throw bad("Invalid push endpoint.");
  const sql = await db();
  await sql`insert into push_subscriptions (user_id, endpoint, p256dh, auth) values (${auth.user.id}, ${input.endpoint}, ${input.keys.p256dh}, ${input.keys.auth})
    on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`;
  return { ok: true };
});

route("POST", "/push/unsubscribe", async ({ request }) => {
  const { user } = await requireUser(request);
  const { endpoint } = await body(request, z.object({ endpoint: z.string().max(1000) }));
  const sql = await db();
  await sql`delete from push_subscriptions where endpoint = ${endpoint} and user_id = ${user.id}`;
  return { ok: true };
});

/** Used by the service worker after a push "tickle": the newest unread notification. */
route("GET", "/notifications/latest", async ({ request }) => {
  const { user } = await requireUser(request);
  const sql = await db();
  const [n] =
    await sql`select title, body, link from notifications where user_id = ${user.id} and read_at is null order by created_at desc limit 1`;
  return { notification: n ?? null };
});

// ================================================================= group challenges
// Collective, anonymous goals per age group. Everyone contributes by doing calm
// things; nobody is ranked and no individual's activity is shown to others.
const challengeDefs: Record<
  string,
  { id: string; title: string; emoji: string; unit: string; goal: number; kinds: string[] }[]
> = {
  kids: [
    {
      id: "bubbles",
      title: "Kids everywhere: 300 calm games this week",
      emoji: "🫧",
      unit: "games",
      goal: 300,
      kinds: ["game"],
    },
    {
      id: "feelings",
      title: "Name 200 feelings together",
      emoji: "🌈",
      unit: "check-ins",
      goal: 200,
      kinds: ["mood"],
    },
  ],
  teen: [
    {
      id: "calm",
      title: "Teens together: 500 calm moments this week",
      emoji: "🎧",
      unit: "moments",
      goal: 500,
      kinds: ["activity", "game"],
    },
    {
      id: "pages",
      title: "Write 250 journal pages between us",
      emoji: "📓",
      unit: "entries",
      goal: 250,
      kinds: ["journal"],
    },
  ],
  adult: [
    {
      id: "breaths",
      title: "Community breath: 1,000 calm minutes this week",
      emoji: "🌬️",
      unit: "sessions",
      goal: 1000,
      kinds: ["activity"],
    },
    {
      id: "checkins",
      title: "2,000 honest check-ins together",
      emoji: "🌤️",
      unit: "check-ins",
      goal: 2000,
      kinds: ["mood"],
    },
  ],
};

function seasonalEvent(month: number) {
  const events: Record<number, { title: string; body: string; emoji: string }> = {
    0: {
      title: "New Year, Gentle Start",
      body: "Small intentions, not resolutions. Write one in your journal.",
      emoji: "🌱",
    },
    1: {
      title: "Kindness Month",
      body: "Notice one kind thing a day — yours or someone else's.",
      emoji: "💛",
    },
    2: {
      title: "Spring Reset",
      body: "Try a new calm game or breathing pattern this month.",
      emoji: "🌷",
    },
    3: {
      title: "Stress Awareness Month",
      body: "One mindful minute a day. That's the whole challenge.",
      emoji: "🫁",
    },
    4: {
      title: "Mental Health Awareness Month",
      body: "Check in honestly — every weather counts.",
      emoji: "🌤️",
    },
    5: {
      title: "Sunlight Month",
      body: "Step outside for five minutes and notice three things.",
      emoji: "☀️",
    },
    6: { title: "Digital Pause", body: "Swap one scroll a day for a slow breath.", emoji: "📵" },
    7: { title: "Friendship Month", body: "Reach out to someone you miss.", emoji: "🤝" },
    8: { title: "Back to Rhythm", body: "Build one tiny routine you can keep.", emoji: "🎵" },
    9: {
      title: "World Mental Health Month",
      body: "Share what helps you — anonymously, if you like.",
      emoji: "🌍",
    },
    10: {
      title: "Gratitude Month",
      body: "Three good things, written down, any day you can.",
      emoji: "🍂",
    },
    11: {
      title: "Quiet Season",
      body: "Rest is productive. Try a sleep wind-down this week.",
      emoji: "❄️",
    },
  };
  return events[month]!;
}

route("GET", "/challenges", async ({ request }) => {
  const { user } = await requireUser(request);
  const group = user.age_group === "early" ? "kids" : user.age_group;
  const defs = challengeDefs[group] ?? [];
  const sql = await db();
  const groups = group === "kids" ? ["kids", "early"] : [group];
  const out = [];
  for (const d of defs) {
    let total = 0;
    let mine = 0;
    for (const k of d.kinds) {
      const table =
        k === "game"
          ? sql`game_results`
          : k === "mood"
            ? sql`mood_entries`
            : k === "journal"
              ? sql`journal_entries`
              : sql`activity_events`;
      const [r] =
        await sql`select count(*)::int as total, count(*) filter (where t.user_id = ${user.id})::int as mine
        from ${table} t join users u on u.id = t.user_id
        where u.age_group in ${sql(groups)} and t.created_at > date_trunc('week', now())`;
      total += (r?.["total"] as number) ?? 0;
      mine += (r?.["mine"] as number) ?? 0;
    }
    out.push({ ...d, total, mine, progress: Math.min(1, total / d.goal) });
  }
  return { challenges: out, event: seasonalEvent(new Date().getUTCMonth()) };
});

// ================================================================= child location status
route("GET", "/location/status", async ({ request }) => {
  const { user } = await requireUser(request);
  if (!user.guardian_id || user.age_group === "teen") return { enabled: false };
  const sql = await db();
  const [r] = await sql`select enabled, shared_at from location_shares where child_id = ${user.id}`;
  return { enabled: !!r?.["enabled"], sharedAt: r?.["shared_at"] ?? null };
});

// ================================================================= wipe wellness data (keep account)
route("POST", "/me/wipe", async ({ request }) => {
  const auth = await requireUser(request);
  if (auth.childMode) throw forbidden();
  const sql = await db();
  const id = auth.user.id;
  await sql.begin(async (tx) => {
    await tx`delete from mood_entries where user_id = ${id}`;
    await tx`delete from journal_entries where user_id = ${id}`;
    await tx`delete from checkins where user_id = ${id}`;
    await tx`delete from companion_sessions where user_id = ${id}`;
    await tx`delete from activity_events where user_id = ${id}`;
    await tx`delete from game_results where user_id = ${id}`;
    await tx`delete from therapist_briefs where sender_id = ${id}`;
    await tx`update users set app_data = '{}'::jsonb where id = ${id}`;
  });
  await audit(id, "account.wipe_data", id, {}, clientIp(request));
  return { ok: true };
});

// ================================================================= therapist partner network
const groupsSchema = z.array(z.enum(["early", "kids", "teen", "adult"])).min(1);

function publicTherapist(t: Record<string, unknown>) {
  return {
    id: t["id"],
    name: t["name"],
    credentials: t["credentials"],
    practice: t["practice"],
    bio: t["bio"],
    city: t["city"],
    country: t["country"],
    issues: t["issues"],
    ageGroups: t["age_groups"],
    languages: t["languages"],
    online: t["online"],
    inPerson: t["in_person"],
    licenseRegion: t["license_region"],
  };
}

route("GET", "/therapists/partners", async ({ request }) => {
  const { user } = await requireUser(request);
  const sql = await db();
  const rows =
    await sql`select * from therapist_profiles where status = 'verified' and accepts_briefs and ${user.age_group} = any(age_groups) order by verified_at`;
  return { partners: rows.map(publicTherapist) };
});

route("POST", "/briefs", async ({ request }) => {
  const auth = await requireUser(request);
  if (auth.childMode) throw forbidden();
  await rateLimit(`brief:${auth.user.id}`, 10, 24 * 60 * 60 * 1000);
  const input = await body(
    request,
    z.object({
      therapistId: z.string().uuid(),
      kind: z.enum(["brief", "update"]),
      body: z.string().min(20).max(20000),
    }),
  );
  const sql = await db();
  const [t] =
    await sql`select id, user_id, name, email from therapist_profiles where id = ${input.therapistId} and status = 'verified' and accepts_briefs`;
  if (!t) throw bad("That therapist isn't accepting briefs right now.");
  const [b] =
    await sql`insert into therapist_briefs (sender_id, therapist_id, kind, body) values (${auth.user.id}, ${t["id"]}, ${input.kind}, ${clean(input.body, 20000)}) returning id, created_at`;
  await notify(
    t["user_id"] as string,
    "message",
    "New self-report brief",
    `From a Pause member (${input.kind}). Open your portal to read it.`,
    "/portal",
  );
  // The email never contains the brief itself — only a prompt to sign in.
  await sendEmail(
    t["email"] as string,
    "A new Pause brief is waiting for you",
    `Hello ${t["name"]},\n\nA Pause member has sent you a self-report ${input.kind}. For privacy, it isn't included in this email.\n\nSign in to read it: ${appUrl("/portal")}\n`,
  );
  return { id: b!["id"], sentAt: b!["created_at"], therapistName: t["name"] };
});

route("GET", "/briefs/mine", async ({ request }) => {
  const { user } = await requireUser(request);
  const sql = await db();
  const rows =
    await sql`select b.id, b.kind, b.created_at, b.read_at, b.confirmed_at, t.name as therapist_name, t.id as therapist_id
    from therapist_briefs b join therapist_profiles t on t.id = b.therapist_id where b.sender_id = ${user.id} order by b.created_at desc`;
  return { briefs: rows };
});

// ---- therapist's own side
route("GET", "/portal/me", async ({ request }) => {
  const { user } = await requireUser(request);
  const sql = await db();
  const [t] = await sql`select * from therapist_profiles where user_id = ${user.id}`;
  return { profile: t ?? null };
});

route("POST", "/portal/apply", async ({ request }) => {
  const auth = await requireUser(request);
  if (auth.user.age_group !== "adult" || auth.childMode)
    throw forbidden("Clinician accounts are for adults.");
  await rateLimit(`apply:${auth.user.id}`, 5, 24 * 60 * 60 * 1000);
  const input = await body(
    request,
    z.object({
      name: z.string().min(2).max(100),
      credentials: z.string().min(2).max(100),
      licenseNumber: z.string().min(3).max(60),
      licenseRegion: z.string().min(2).max(60),
      practice: z.string().max(120).default(""),
      email: z.string().email().max(200),
      phone: z.string().max(30).default(""),
      bio: z.string().max(1500).default(""),
      city: z.string().max(80).default(""),
      country: z.string().max(80).default(""),
      issues: z.array(z.string().max(40)).max(20).default([]),
      ageGroups: groupsSchema,
      languages: z.array(z.string().max(30)).max(10).default([]),
      online: z.boolean().default(true),
      inPerson: z.boolean().default(false),
    }),
  );
  const sql = await db();
  const existing = await sql`select status from therapist_profiles where user_id = ${auth.user.id}`;
  if (existing[0] && existing[0]["status"] === "verified") throw bad("You're already verified.");
  await sql`insert into therapist_profiles (user_id, name, credentials, license_number, license_region, practice, email, phone, bio, city, country, issues, age_groups, languages, online, in_person, status)
    values (${auth.user.id}, ${clean(input.name, 100)}, ${clean(input.credentials, 100)}, ${clean(input.licenseNumber, 60)}, ${clean(input.licenseRegion, 60)}, ${clean(input.practice, 120)},
      ${input.email.toLowerCase()}, ${clean(input.phone, 30)}, ${clean(input.bio, 1500)}, ${clean(input.city, 80)}, ${clean(input.country, 80)}, ${input.issues}, ${input.ageGroups}, ${input.languages}, ${input.online}, ${input.inPerson}, 'pending')
    on conflict (user_id) do update set name = excluded.name, credentials = excluded.credentials, license_number = excluded.license_number, license_region = excluded.license_region,
      practice = excluded.practice, email = excluded.email, phone = excluded.phone, bio = excluded.bio, city = excluded.city, country = excluded.country, issues = excluded.issues,
      age_groups = excluded.age_groups, languages = excluded.languages, online = excluded.online, in_person = excluded.in_person, status = 'pending'`;
  const admins = await sql`select id from users where role = 'admin' and status = 'active'`;
  for (const a of admins)
    await notify(
      a["id"] as string,
      "moderation",
      "New therapist application",
      clean(input.name, 80),
      "/admin?tab=therapists",
    );
  return { ok: true, status: "pending" };
});

route("PATCH", "/portal/me", async ({ request }) => {
  const { user } = await requireUser(request);
  const input = await body(
    request,
    z.object({ acceptsBriefs: z.boolean().optional(), leave: z.boolean().optional() }),
  );
  const sql = await db();
  if (input.leave) {
    await sql`delete from therapist_profiles where user_id = ${user.id}`;
    return { ok: true };
  }
  await sql`update therapist_profiles set accepts_briefs = coalesce(${input.acceptsBriefs ?? null}, accepts_briefs) where user_id = ${user.id}`;
  return { ok: true };
});

async function myVerifiedProfile(userId: string) {
  const sql = await db();
  const [t] =
    await sql`select id from therapist_profiles where user_id = ${userId} and status in ('verified','paused')`;
  if (!t) throw forbidden("Only verified partner therapists can open the brief inbox.");
  return t["id"] as string;
}

route("GET", "/portal/briefs", async ({ request }) => {
  const { user } = await requireUser(request);
  const tid = await myVerifiedProfile(user.id);
  const sql = await db();
  const rows = await sql`select b.id, b.kind, b.body, b.created_at, b.read_at, b.confirmed_at,
      case when s.identity_mode = 'name' then s.display_name else coalesce(s.community_alias, 'A Pause member') end as from_name
    from therapist_briefs b join users s on s.id = b.sender_id where b.therapist_id = ${tid} order by b.created_at desc limit 200`;
  await sql`update therapist_briefs set read_at = now() where therapist_id = ${tid} and read_at is null`;
  return { briefs: rows };
});

route("POST", "/portal/briefs/:id/confirm", async ({ request, params }) => {
  const { user } = await requireUser(request);
  const tid = await myVerifiedProfile(user.id);
  const sql = await db();
  const [b] =
    await sql`update therapist_briefs set confirmed_at = now() where id = ${params["id"]!} and therapist_id = ${tid} and confirmed_at is null returning sender_id`;
  if (!b) throw notFound();
  const [t] = await sql`select name from therapist_profiles where id = ${tid}`;
  await notify(
    b["sender_id"] as string,
    "message",
    `${t?.["name"] ?? "Your therapist"} received your brief`,
    "They've confirmed it arrived. 💛",
    "/therapist",
  );
  return { ok: true };
});

// ---- admin verification
route("GET", "/admin/therapists", async ({ request, url }) => {
  await requireAdmin(request);
  const status = url.searchParams.get("status") ?? "pending";
  const sql = await db();
  const rows =
    await sql`select t.*, u.email as account_email, (select count(*) from therapist_briefs b where b.therapist_id = t.id)::int as briefs
    from therapist_profiles t join users u on u.id = t.user_id where t.status = ${status} order by t.created_at desc`;
  return { therapists: rows };
});

route("POST", "/admin/therapists/:id", async ({ request, params }) => {
  const auth = await requireAdmin(request);
  const input = await body(
    request,
    z.object({
      action: z.enum(["verify", "reject", "pause", "reinstate"]),
      note: z.string().max(500).optional(),
    }),
  );
  const status = { verify: "verified", reject: "rejected", pause: "paused", reinstate: "verified" }[
    input.action
  ];
  const sql = await db();
  const [t] =
    await sql`update therapist_profiles set status = ${status}, review_note = ${input.note ?? ""},
      verified_by = ${auth.user.id}, verified_at = case when ${status} = 'verified' then now() else verified_at end
    where id = ${params["id"]!} returning user_id, name`;
  if (!t) throw notFound();
  await notify(
    t["user_id"] as string,
    "security",
    input.action === "verify" || input.action === "reinstate"
      ? "You're a verified Pause partner ✅"
      : input.action === "pause"
        ? "Your partner listing is paused"
        : "About your partner application",
    input.note ||
      (input.action === "verify" ? "Members can now send you their self-report briefs." : ""),
    "/portal",
  );
  await audit(
    auth.user.id,
    `therapist.${input.action}`,
    params["id"]!,
    { name: t["name"] },
    clientIp(request),
  );
  return { ok: true };
});

export { publicName };

// ================================================================= scheduled jobs (serverless)
/**
 * For hosts without long-running processes (e.g. Vercel Cron). Protected by
 * CRON_SECRET: Vercel sends it as "Authorization: Bearer <CRON_SECRET>".
 */
route("GET", "/cron/tick", async ({ request }) => {
  const { env } = await import("../db");
  const secret = env("CRON_SECRET");
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) throw forbidden();
  const { tick } = await import("../scheduler");
  await tick();
  return { ok: true };
});
