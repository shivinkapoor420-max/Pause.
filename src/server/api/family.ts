import { z } from "zod";
import { db } from "../db";
import { ageInYears, groupForAge, requireGuardianOf, requireUser, type UserRow } from "../auth";
import { hashPassword } from "../crypto";
import { bad, body, clean, forbidden } from "../http";
import { route } from "../router";
import { notify } from "../services";
import { passwordSchema, usernameSchema } from "./auth";

/**
 * Parent / guardian side. Every child profile (4–17) is created by an adult
 * guardian account — that adult is the account owner and gives consent.
 */

export const defaultControls = {
  aiCompanion: true, // ignored for 4–7: unrestricted chat is never available to them
  games: true,
  journal: true,
  dailyMinutes: 30,
  location: false,
};

async function requireGuardian(request: Request) {
  const auth = await requireUser(request);
  if (auth.childMode || auth.user.age_group !== "adult") throw forbidden("Only adult accounts can manage family profiles.");
  return auth;
}

route("GET", "/family/children", async ({ request }) => {
  const auth = await requireGuardian(request);
  const sql = await db();
  const kids = await sql<UserRow[]>`select * from users where guardian_id = ${auth.user.id} and status = 'active' order by birth_date desc`;
  const out = [];
  for (const k of kids) {
    const teen = k.age_group === "teen";
    const sharesTrends = !teen || k.prefs["shareTrendsWithGuardian"] === true;
    const [summary] = await sql`select
      (select count(*) from mood_entries where user_id = ${k.id} and day > current_date - 7)::int as checkins_7d,
      (select count(*) from activity_events where user_id = ${k.id} and created_at > now() - interval '7 days')::int as activities_7d,
      (select count(*) from game_results where user_id = ${k.id} and created_at > now() - interval '7 days')::int as games_7d,
      (select coalesce(sum(duration_s),0) from game_results where user_id = ${k.id} and created_at > current_date)::int as game_seconds_today,
      (select max(created_at) from activity_events where user_id = ${k.id}) as last_active`;
    const moods = sharesTrends
      ? await sql`select day, sky from mood_entries where user_id = ${k.id} and day > current_date - 14 order by day`
      : [];
    const flagged = await sql`select 1 from checkins where user_id = ${k.id} and flagged and created_at > now() - interval '14 days' limit 1`;
    const loc = await sql`select enabled, lat, lng, accuracy_m, shared_at from location_shares where child_id = ${k.id}`;
    out.push({
      id: k.id,
      displayName: k.display_name,
      username: k.username,
      ageGroup: k.age_group,
      age: ageInYears(k.birth_date),
      avatarStyle: k.avatar_style,
      controls: { ...defaultControls, ...((k.prefs["controls"] as object) ?? {}) },
      sharesTrends,
      summary,
      moods,
      // Safety alerts are always shared with the guardian, whatever the privacy settings.
      safetyAlert: flagged.length > 0,
      location: loc[0] ?? { enabled: false },
    });
  }
  return { children: out };
});

route("POST", "/family/children", async ({ request }) => {
  const auth = await requireGuardian(request);
  const input = await body(
    request,
    z.object({
      displayName: z.string().min(1).max(40),
      birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      username: usernameSchema.optional(),
      password: passwordSchema.optional(),
      guardianConsent: z.literal(true),
    }),
  );
  const group = groupForAge(ageInYears(input.birthDate));
  if (!group) throw bad("Pause is designed for ages 4 and up.");
  if (group === "adult") throw bad("Adults create their own account.");
  const sql = await db();
  const count = await sql`select count(*)::int as n from users where guardian_id = ${auth.user.id} and status = 'active'`;
  if ((count[0]?.["n"] as number) >= 8) throw bad("You can add up to 8 family profiles.");

  const ownLogin = group !== "early";
  if (ownLogin && (!input.username || !input.password)) {
    throw bad("Ages 8+ get their own sign-in. Choose a username and password for them.");
  }
  const username = input.username ?? `kid_${Math.random().toString(36).slice(2, 10)}`;
  const taken = await sql`select 1 from users where lower(username) = ${username.toLowerCase()}`;
  if (taken.length) throw bad("That username is taken — try another.");

  const [child] = await sql<UserRow[]>`insert into users (username, password_hash, display_name, birth_date, age_group, guardian_id, consented_at, profile_visibility, prefs)
    values (${username}, ${ownLogin && input.password ? await hashPassword(input.password) : null}, ${clean(input.displayName, 40)},
      ${input.birthDate}, ${group}, ${auth.user.id}, now(), 'private',
      ${sql.json({ controls: defaultControls, notifyAchievements: true, notifyReminders: group !== "early" } as never)})
    returning *`;
  await sql`insert into consents (user_id, granted_by, kind, granted) values (${child!.id}, ${auth.user.id}, 'guardian', true)`;
  return { id: child!.id };
});

route("PATCH", "/family/children/:childId", async ({ request, params }) => {
  const { child } = await requireGuardianOf(request, params["childId"]!);
  const input = await body(
    request,
    z.object({
      displayName: z.string().min(1).max(40).optional(),
      password: passwordSchema.optional(),
      controls: z
        .object({
          aiCompanion: z.boolean().optional(),
          games: z.boolean().optional(),
          journal: z.boolean().optional(),
          dailyMinutes: z.number().int().min(5).max(240).optional(),
        })
        .optional(),
    }),
  );
  const sql = await db();
  const controls = { ...defaultControls, ...((child.prefs["controls"] as object) ?? {}), ...(input.controls ?? {}) };
  await sql`update users set
    display_name = ${input.displayName ? clean(input.displayName, 40) : child.display_name},
    prefs = prefs || ${sql.json({ controls } as never)},
    updated_at = now() where id = ${child.id}`;
  if (input.password && child.age_group !== "early") {
    await sql`update users set password_hash = ${await hashPassword(input.password)} where id = ${child.id}`;
    await sql`delete from sessions where user_id = ${child.id}`;
  }
  return { ok: true };
});

route("DELETE", "/family/children/:childId", async ({ request, params }) => {
  const { child } = await requireGuardianOf(request, params["childId"]!);
  const sql = await db();
  await sql`delete from users where id = ${child.id}`; // cascades all of the child's data
  return { ok: true };
});

// ---------------------------------------------------------------- location (off by default)
route("POST", "/family/children/:childId/location", async ({ request, params }) => {
  const { auth, child } = await requireGuardianOf(request, params["childId"]!);
  const { enabled } = await body(request, z.object({ enabled: z.boolean() }));
  if (child.age_group === "teen") throw bad("Location sharing isn't offered for teen profiles.");
  const sql = await db();
  await sql`insert into location_shares (child_id, enabled) values (${child.id}, ${enabled})
    on conflict (child_id) do update set enabled = ${enabled}, lat = case when ${enabled} then location_shares.lat else null end,
      lng = case when ${enabled} then location_shares.lng else null end, shared_at = case when ${enabled} then location_shares.shared_at else null end`;
  await sql`insert into consents (user_id, granted_by, kind, granted) values (${child.id}, ${auth.user.id}, 'location', ${enabled})`;
  return { ok: true };
});

/** Called from the child's own device, only when they tap "Share where I am" and the guardian enabled it. */
route("POST", "/location", async ({ request }) => {
  const auth = await requireUser(request);
  if (!auth.user.guardian_id || auth.user.age_group === "teen") throw forbidden();
  const input = await body(request, z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), accuracy: z.number().min(0).max(100000) }));
  const sql = await db();
  const rows = await sql`update location_shares set lat = ${input.lat}, lng = ${input.lng}, accuracy_m = ${Math.round(input.accuracy)}, shared_at = now()
    where child_id = ${auth.user.id} and enabled returning child_id`;
  if (!rows.length) throw forbidden("Location sharing is turned off.");
  await notify(auth.user.guardian_id, "family", `${auth.user.display_name} shared their location`, "", "/family");
  return { ok: true };
});

// ---------------------------------------------------------------- teen privacy
route("POST", "/me/guardian-sharing", async ({ request }) => {
  const auth = await requireUser(request);
  if (auth.user.age_group !== "teen") throw forbidden();
  const { share } = await body(request, z.object({ share: z.boolean() }));
  const sql = await db();
  await sql`update users set prefs = prefs || ${sql.json({ shareTrendsWithGuardian: share } as never)} where id = ${auth.user.id}`;
  return { ok: true };
});
