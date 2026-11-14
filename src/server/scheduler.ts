/**
 * Lightweight in-process scheduler (every 10 minutes). Safe to run on several
 * instances: every job is idempotent (reminder_log primary key, conditional
 * updates). Disable with DISABLE_SCHEDULER=true if you prefer an external cron.
 */
import { env, getSql } from "./db";
import { appUrl, notify, sendEmail } from "./services";

const g = globalThis as unknown as { __pauseScheduler?: ReturnType<typeof setInterval> };

export function startScheduler() {
  // Serverless hosts (Vercel) can't keep timers alive; they call /api/v1/cron/tick instead.
  if (g.__pauseScheduler || env("DISABLE_SCHEDULER") === "true" || env("VERCEL")) return;
  const run = () => void tick().catch((e) => console.error("[scheduler]", e));
  g.__pauseScheduler = setInterval(run, 10 * 60 * 1000);
  setTimeout(run, 15_000);
}

function localParts(tz: string | undefined) {
  try {
    const f = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const p = Object.fromEntries(f.formatToParts(new Date()).map((x) => [x.type, x.value]));
    return {
      day: `${p["year"]}-${p["month"]}-${p["day"]}`,
      minutes: Number(p["hour"]) * 60 + Number(p["minute"]),
    };
  } catch {
    return localParts("UTC");
  }
}

export async function tick() {
  const sql = getSql();

  // 1. Gentle daily check-in reminders (in-app + push, optional email). Never for 4–7s.
  const candidates = await sql<
    { id: string; email: string | null; display_name: string; prefs: Record<string, any> }[]
  >`
    select id, email, display_name, prefs from users
    where status = 'active' and age_group <> 'early' and coalesce((prefs->>'notifyReminders')::boolean, true)
      and last_seen_at > now() - interval '30 days'`;
  for (const u of candidates) {
    const { day, minutes } = localParts(u.prefs["tz"]);
    const [hh, mm] = String(u.prefs["reminderTime"] ?? "19:00")
      .split(":")
      .map(Number);
    if (minutes < (hh ?? 19) * 60 + (mm ?? 0)) continue;
    const done =
      await sql`select 1 from mood_entries where user_id = ${u.id} and day >= ${day}::date - 1 and created_at > now() - interval '20 hours' limit 1`;
    if (done.length) continue;
    const fresh =
      await sql`insert into reminder_log (user_id, day, kind) values (${u.id}, ${day}, 'checkin') on conflict do nothing returning day`;
    if (!fresh.length) continue;
    await notify(
      u.id,
      "reminder",
      "How's the weather inside today? 🌤️",
      "A ten-second check-in — any answer counts.",
      "/home#mood",
    );
    if (u.email && u.prefs["emailReminders"] === true) {
      await sendEmail(
        u.email,
        "A gentle check-in from Pause",
        `Hi ${u.display_name},\n\nHow's today feeling? One tap is enough:\n${appUrl("/home#mood")}\n\nYou can change or turn off these reminders in Settings.`,
      );
    }
  }

  // 2. Subscriptions that reached the end of a cancelled period (or a test-mode period) end now.
  const ended = await sql<
    { user_id: string }[]
  >`update subscriptions set status = 'canceled', updated_at = now()
    where status in ('active','trialing','past_due') and current_period_end < now()
      and (cancel_at_period_end or provider = 'sandbox') returning user_id`;
  for (const s of ended)
    await notify(
      s.user_id,
      "subscription",
      "Your Premium plan has ended",
      "Your data and all free features stay exactly as they are.",
      "/billing",
    );

  // 3. Housekeeping.
  await sql`delete from sessions where expires_at < now()`;
  await sql`delete from rate_limits where window_start < now() - interval '2 days'`;
  await sql`delete from auth_tokens where expires_at < now() - interval '1 day'`;
  await sql`delete from ai_usage where day < current_date - 30`;
  await sql`delete from reminder_log where day < current_date - 14`;
  await sql`delete from notifications where read_at is not null and created_at < now() - interval '180 days'`;
}
