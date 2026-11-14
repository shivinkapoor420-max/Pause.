/**
 * Cross-cutting services: entitlements, realtime fan-out, notifications,
 * moderation filters, email and XP/achievements.
 */
import { EventEmitter } from "node:events";
import postgres from "postgres";
import { db, env, getSql } from "./db";
import type { UserRow } from "./auth";

// ---------------------------------------------------------------- entitlements
export const FREE_AI_DAILY = 10;
export const PREMIUM_AI_DAILY = 150;
export const KIDS_AI_DAILY = 15;

/** Premium if the user — or, for a child profile, their guardian — has an active subscription. */
export async function isPremium(user: Pick<UserRow, "id" | "guardian_id">): Promise<boolean> {
  const sql = await db();
  const ids = [user.id, user.guardian_id].filter(Boolean) as string[];
  const rows = await sql`select 1 from subscriptions where user_id in ${sql(ids)}
    and status in ('active','trialing','past_due') and (current_period_end is null or current_period_end > now()) limit 1`;
  return rows.length > 0;
}

// ---------------------------------------------------------------- realtime
// Events are published through Postgres NOTIFY so every server instance gets
// them, then fanned out in-process to open Server-Sent-Event streams.
export type RealtimeEvent = { users: string[]; type: string; data?: unknown };
const g = globalThis as unknown as {
  __pauseBus?: EventEmitter;
  __pauseListening?: Promise<void> | undefined;
};
export const bus = g.__pauseBus ?? (g.__pauseBus = new EventEmitter().setMaxListeners(0));

/**
 * LISTEN needs a direct (session) connection. Connection poolers such as
 * Neon's or Supabase's transaction pooler drop it, so use the unpooled URL
 * when the host provides one (Vercel + Neon sets DATABASE_URL_UNPOOLED).
 */
let listenClient: ReturnType<typeof getSql> | undefined;
function listenSql() {
  const direct = env("DATABASE_URL_UNPOOLED") || env("LISTEN_DATABASE_URL");
  if (!direct) return getSql();
  if (!listenClient) {
    listenClient = postgres(direct, {
      max: 1,
      ssl: env("DATABASE_SSL") === "require" ? "require" : false,
      onnotice: () => {},
    }) as unknown as ReturnType<typeof getSql>;
  }
  return listenClient;
}

export function ensureListening() {
  if (!g.__pauseListening) {
    g.__pauseListening = (async () => {
      await db();
      await listenSql().listen("pause_events", (payload) => {
        try {
          const ev = JSON.parse(payload) as RealtimeEvent;
          for (const u of ev.users) bus.emit(`user:${u}`, ev);
        } catch {
          /* ignore malformed */
        }
      });
    })().catch((e) => {
      g.__pauseListening = undefined;
      throw e;
    });
  }
  return g.__pauseListening;
}

export async function publish(ev: RealtimeEvent) {
  if (ev.users.length === 0) return;
  const sql = await db();
  const payload = JSON.stringify(ev);
  // NOTIFY payloads are capped at 8KB; send a slim "refresh" hint if larger.
  await sql`select pg_notify('pause_events', ${payload.length < 7500 ? payload : JSON.stringify({ users: ev.users, type: ev.type })})`;
}

// ---------------------------------------------------------------- notifications
type NotifyKind =
  | "message"
  | "community"
  | "achievement"
  | "subscription"
  | "security"
  | "reminder"
  | "family"
  | "moderation";

const prefKey: Record<NotifyKind, string> = {
  message: "notifyMessages",
  community: "notifyCommunity",
  achievement: "notifyAchievements",
  subscription: "notifyBilling",
  security: "notifySecurity",
  reminder: "notifyReminders",
  family: "notifyFamily",
  moderation: "notifySecurity",
};

export async function notify(
  userId: string,
  kind: NotifyKind,
  title: string,
  body = "",
  link = "",
) {
  const sql = await db();
  const rows = await sql<
    { prefs: Record<string, unknown> }[]
  >`select prefs from users where id = ${userId}`;
  const prefs = rows[0]?.prefs ?? {};
  // Security and billing notices are always delivered.
  if (kind !== "security" && kind !== "subscription" && prefs[prefKey[kind]] === false) return;
  await sql`insert into notifications (user_id, kind, title, body, link) values (${userId}, ${kind}, ${title}, ${body}, ${link})`;
  await publish({ users: [userId], type: "notification" });
  // Wake the user's browsers (Web Push). Fire-and-forget so it never slows a request.
  void import("./push").then((m) => m.pushTo(userId));
}

// ---------------------------------------------------------------- moderation
const severe = [
  /\bkill yourself\b/i,
  /\bkys\b/i,
  /\bgo die\b/i,
  /\b(you should|u should) (die|end it)\b/i,
  /\bn[i1]gg(a|er)\b/i,
  /\bf[a@]gg?[o0]t\b/i,
  /\bretard(ed)?\b/i,
];
const harassment = [
  /\b(stupid|worthless|pathetic|disgusting) (bitch|loser|idiot)\b/i,
  /\bnobody (likes|cares about) you\b/i,
  /\bshut up\b.*\bidiot\b/i,
];
const spam = [
  /\b(buy now|limited offer|crypto giveaway|dm me for|whatsapp me|earn \$?\d+ (a|per) day)\b/i,
];

export type ModerationVerdict = { action: "allow" | "review" | "block"; reasons: string[] };

export function moderateText(text: string): ModerationVerdict {
  const reasons: string[] = [];
  if (severe.some((r) => r.test(text))) return { action: "block", reasons: ["abusive_language"] };
  if (harassment.some((r) => r.test(text))) reasons.push("possible_harassment");
  if (spam.some((r) => r.test(text))) reasons.push("possible_spam");
  const links = (text.match(/https?:\/\//gi) ?? []).length;
  if (links >= 3) reasons.push("many_links");
  if (/(.)\1{14,}/.test(text)) reasons.push("repetition");
  return { action: reasons.length ? "review" : "allow", reasons };
}

export async function autoReport(
  targetKind: "post" | "comment" | "message",
  targetId: string,
  reasons: string[],
) {
  const sql = await db();
  await sql`insert into reports (reporter_id, target_kind, target_id, reason, details)
    values (null, ${targetKind}, ${targetId}, ${"automated_filter"}, ${reasons.join(", ")})`;
}

/** Duplicate-post spam guard: same body from the same author within 10 minutes. */
export async function isDuplicate(table: "posts" | "comments", authorId: string, text: string) {
  const sql = await db();
  const rows =
    await sql`select 1 from ${sql(table)} where author_id = ${authorId} and body = ${text}
    and created_at > now() - interval '10 minutes' limit 1`;
  return rows.length > 0;
}

// ---------------------------------------------------------------- email
/**
 * Mail is sent through Resend when RESEND_API_KEY is set. Without it, emails
 * are written to the server log so local development still works end to end.
 */
export async function sendEmail(to: string, subject: string, text: string) {
  const key = env("RESEND_API_KEY");
  if (!key) {
    console.info(`[mail:dev] to=${to} subject="${subject}"\n${text}`);
    return { delivered: false };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: env("MAIL_FROM", "Pause <hello@example.com>"),
      to,
      subject,
      text,
    }),
  });
  if (!res.ok) console.error("[mail] send failed", res.status, await res.text().catch(() => ""));
  return { delivered: res.ok };
}

export function appUrl(path = "") {
  return `${env("APP_URL", "http://localhost:3000").replace(/\/$/, "")}${path}`;
}

// ---------------------------------------------------------------- XP + achievements
export const achievementCatalog: Record<
  string,
  { title: string; body: string; emoji: string; premium?: boolean }
> = {
  first_checkin: {
    title: "First check-in",
    body: "You noticed how you felt. That's the whole start.",
    emoji: "🌱",
  },
  checkin_7: {
    title: "A week of noticing",
    body: "Seven days of checking in — any weather counts.",
    emoji: "🌤️",
  },
  checkin_30: {
    title: "A month of noticing",
    body: "Thirty check-ins. A whole season is forming.",
    emoji: "🌳",
  },
  first_journal: { title: "First page", body: "You wrote something down.", emoji: "📓" },
  journal_10: { title: "Ten pages", body: "Ten journal entries.", emoji: "📚" },
  first_breath: { title: "First breath", body: "You finished a breathing exercise.", emoji: "🫧" },
  breath_10: { title: "Steady breather", body: "Ten breathing sessions.", emoji: "🌬️" },
  first_game: { title: "Player one", body: "You played your first calm game.", emoji: "🎮" },
  games_5_kinds: { title: "Explorer", body: "Tried five different games.", emoji: "🧭" },
  games_25: { title: "Regular", body: "Played 25 games.", emoji: "⭐" },
  first_post: {
    title: "First words shared",
    body: "You shared something with the community.",
    emoji: "💬",
    premium: false,
  },
  helper: { title: "Kind presence", body: "Left ten supportive comments.", emoji: "🤝" },
  garden_20: { title: "Gardener", body: "Your garden has twenty things growing.", emoji: "🌷" },
  premium_supporter: {
    title: "Supporter",
    body: "Thanks for supporting Pause.",
    emoji: "💛",
    premium: true,
  },
};

/** XP is capped per day so nobody is rewarded for excessive use. Never tied to mood. */
const DAILY_XP_CAP = 120;

export async function awardXp(userId: string, amount: number, reason: string) {
  const sql = await db();
  const [{ total } = { total: 0 }] = await sql<{ total: number }[]>`
    select coalesce(sum(amount),0)::int as total from xp_ledger where user_id = ${userId} and day = current_date`;
  const grant = Math.max(0, Math.min(amount, DAILY_XP_CAP - total));
  if (grant > 0)
    await sql`insert into xp_ledger (user_id, amount, reason) values (${userId}, ${grant}, ${reason})`;
  return grant;
}

export async function grantAchievement(userId: string, key: string) {
  const sql = await db();
  const def = achievementCatalog[key];
  if (!def) return false;
  const rows =
    await sql`insert into user_achievements (user_id, key) values (${userId}, ${key}) on conflict do nothing returning key`;
  if (rows.length) {
    await notify(userId, "achievement", `${def.emoji} ${def.title}`, def.body, "/achievements");
    return true;
  }
  return false;
}

/** Re-evaluates count-based achievements after an activity. Cheap, indexed counts. */
export async function checkAchievements(userId: string) {
  const sql = await db();
  const [c] = await sql<
    {
      moods: number;
      journals: number;
      breaths: number;
      games: number;
      kinds: number;
      comments: number;
    }[]
  >`
    select
      (select count(*) from mood_entries where user_id = ${userId})::int as moods,
      (select count(*) from journal_entries where user_id = ${userId})::int as journals,
      (select count(*) from activity_events where user_id = ${userId} and kind in ('breathing','grounding'))::int as breaths,
      (select count(*) from game_results where user_id = ${userId})::int as games,
      (select count(distinct game) from game_results where user_id = ${userId})::int as kinds,
      (select count(*) from comments where author_id = ${userId})::int as comments`;
  if (!c) return;
  const checks: [boolean, string][] = [
    [c.moods >= 1, "first_checkin"],
    [c.moods >= 7, "checkin_7"],
    [c.moods >= 30, "checkin_30"],
    [c.journals >= 1, "first_journal"],
    [c.journals >= 10, "journal_10"],
    [c.breaths >= 1, "first_breath"],
    [c.breaths >= 10, "breath_10"],
    [c.games >= 1, "first_game"],
    [c.kinds >= 5, "games_5_kinds"],
    [c.games >= 25, "games_25"],
    [c.comments >= 10, "helper"],
  ];
  for (const [ok, key] of checks) if (ok) await grantAchievement(userId, key);
}
