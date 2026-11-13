import { z } from "zod";
import { db } from "../db";
import {
  PARENT_COOKIE,
  SESSION_COOKIE,
  ageInYears,
  audit,
  cookie,
  createSession,
  destroySession,
  generateAlias,
  getAuth,
  groupForAge,
  requireUser,
  selfView,
  sessionToken,
  type UserRow,
} from "../auth";
import { hashPassword, randomToken, sha256, verifyPassword } from "../crypto";
import { bad, body, clean, clientIp, forbidden, json, rateLimit, unauthorized } from "../http";
import { route } from "../router";
import { appUrl, isPremium, notify, sendEmail } from "../services";

export const usernameSchema = z
  .string()
  .min(3)
  .max(24)
  .regex(/^[a-z0-9_]+$/i, "Use letters, numbers and underscores only");
export const passwordSchema = z.string().min(8, "Use at least 8 characters").max(200);
const birthSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

async function issueEmailToken(
  userId: string,
  kind: "verify_email" | "reset_password",
  hours: number,
) {
  const sql = await db();
  const token = randomToken();
  await sql`insert into auth_tokens (user_id, kind, token_hash, expires_at)
    values (${userId}, ${kind}, ${sha256(token)}, now() + ${`${hours} hours`}::interval)`;
  return token;
}

async function sendVerification(user: { id: string; email: string | null; display_name: string }) {
  if (!user.email) return;
  const token = await issueEmailToken(user.id, "verify_email", 48);
  await sendEmail(
    user.email,
    "Confirm your email for Pause.",
    `Hi ${user.display_name},\n\nConfirm your email to finish setting up Pause.:\n${appUrl(`/verify?token=${token}`)}\n\nIf you didn't sign up, you can ignore this email.`,
  );
}

route("POST", "/auth/signup", async ({ request }) => {
  await rateLimit(`signup:${clientIp(request)}`, 8, 60 * 60 * 1000);
  const input = await body(
    request,
    z.object({
      email: z.string().email().max(200),
      password: passwordSchema,
      username: usernameSchema,
      displayName: z.string().min(1).max(60),
      birthDate: birthSchema,
      acceptTerms: z.literal(true),
    }),
  );
  const age = ageInYears(input.birthDate);
  const group = groupForAge(age);
  if (!group) throw bad("Please check your date of birth.");
  if (group !== "adult") {
    throw forbidden(
      "Pause accounts for under-18s are created by a parent or guardian from their own account. Ask a grown-up to sign up and add you from their Family page.",
      "guardian_required",
    );
  }
  const sql = await db();
  const email = input.email.toLowerCase();
  const taken =
    await sql`select email, lower(username) as u from users where email = ${email} or lower(username) = ${input.username.toLowerCase()}`;
  if (taken.some((t) => t["email"] === email))
    throw bad("An account with this email already exists. Try signing in.", "email_taken");
  if (taken.length) throw bad("That username is taken — try another.", "username_taken");

  let alias = generateAlias();
  for (
    let i = 0;
    i < 5 && (await sql`select 1 from users where community_alias = ${alias}`).length;
    i++
  )
    alias = generateAlias();
  const [user] = await sql<
    UserRow[]
  >`insert into users (email, username, community_alias, password_hash, display_name, birth_date, age_group, consented_at, prefs)
    values (${email}, ${input.username}, ${alias}, ${await hashPassword(input.password)}, ${clean(input.displayName, 60)}, ${input.birthDate}, ${group}, now(),
      ${sql.json({ notifyMessages: true, notifyCommunity: true, notifyAchievements: true, notifyReminders: true, readReceipts: true, showOnline: false, leaderboardOptIn: false } as never)})
    returning *`;
  if (!user) throw new Error("insert failed");
  await sql`insert into consents (user_id, kind, granted) values (${user.id}, 'terms', true), (${user.id}, 'privacy', true)`;
  await sendVerification(user);
  const s = await createSession(user.id, request);
  return json({ user: selfView(user) }, { headers: { "set-cookie": s.cookie } });
});

route("POST", "/auth/login", async ({ request }) => {
  const input = await body(
    request,
    z.object({ login: z.string().min(1).max(200), password: z.string().min(1).max(200) }),
  );
  const ip = clientIp(request);
  await rateLimit(`login:${ip}`, 20, 15 * 60 * 1000);
  await rateLimit(`login:${input.login.toLowerCase()}`, 8, 15 * 60 * 1000);
  const sql = await db();
  const login = input.login.toLowerCase();
  const rows = await sql<
    UserRow[]
  >`select * from users where (email = ${login} or lower(username) = ${login}) and status <> 'deleted'`;
  const user = rows[0];
  const ok = user
    ? await verifyPassword(input.password, user.password_hash)
    : await verifyPassword(input.password, null);
  if (!user || !ok) throw unauthorized("That email/username and password don't match.");
  if (user.status === "suspended")
    throw forbidden(
      "This account is suspended. Contact us if you think this is a mistake.",
      "suspended",
    );
  if (user.age_group === "early")
    throw forbidden("Little ones use Pause from their grown-up's account.", "guardian_required");
  const s = await createSession(user.id, request);
  await sql`update users set last_seen_at = now() where id = ${user.id}`;
  if (user.role === "admin") await audit(user.id, "admin.login", "", {}, ip);
  return json(
    { user: selfView(user, { premium: await isPremium(user) }) },
    { headers: { "set-cookie": s.cookie } },
  );
});

route("POST", "/auth/logout", async ({ request }) => {
  await destroySession(sessionToken(request));
  await destroySession(sessionToken(request, PARENT_COOKIE));
  const headers = new Headers();
  headers.append("set-cookie", cookie(SESSION_COOKIE, "", 0));
  headers.append("set-cookie", cookie(PARENT_COOKIE, "", 0));
  return json({ ok: true }, { headers });
});

route("GET", "/auth/me", async ({ request }) => {
  const auth = await getAuth(request);
  if (!auth) return { user: null };
  const sql = await db();
  const [counts] = await sql`select
    (select count(*) from notifications where user_id = ${auth.user.id} and read_at is null)::int as notifications,
    (select count(*) from conversation_members cm join conversations c on c.id = cm.conversation_id
       where cm.user_id = ${auth.user.id} and cm.status <> 'left' and c.last_message_at > cm.last_read_at)::int as messages`;
  let guardianControls: Record<string, unknown> = {};
  if (auth.user.guardian_id)
    guardianControls = (auth.user.prefs["controls"] as Record<string, unknown>) ?? {};
  return {
    user: selfView(auth.user, { childMode: auth.childMode, premium: await isPremium(auth.user) }),
    unread: counts,
    controls: guardianControls,
  };
});

route("POST", "/auth/verify-email", async ({ request }) => {
  const { token } = await body(request, z.object({ token: z.string().min(10).max(200) }));
  const sql = await db();
  const rows =
    await sql`update auth_tokens set used_at = now() where token_hash = ${sha256(token)} and kind = 'verify_email'
    and used_at is null and expires_at > now() returning user_id`;
  if (!rows[0])
    throw bad("This link has expired or was already used. Request a new one from Settings.");
  await sql`update users set email_verified_at = now() where id = ${rows[0]["user_id"]}`;
  return { ok: true };
});

route("POST", "/auth/resend-verification", async ({ request }) => {
  const auth = await requireUser(request);
  await rateLimit(`verify:${auth.user.id}`, 3, 60 * 60 * 1000);
  if (auth.user.email_verified_at) return { ok: true, alreadyVerified: true };
  await sendVerification(auth.user);
  return { ok: true };
});

route("POST", "/auth/forgot", async ({ request }) => {
  const { email } = await body(request, z.object({ email: z.string().email() }));
  await rateLimit(`forgot:${clientIp(request)}`, 5, 60 * 60 * 1000);
  const sql = await db();
  const rows = await sql<
    UserRow[]
  >`select * from users where email = ${email.toLowerCase()} and status = 'active'`;
  const user = rows[0];
  if (user) {
    const token = await issueEmailToken(user.id, "reset_password", 1);
    await sendEmail(
      user.email!,
      "Reset your Pause. password",
      `Hi ${user.display_name},\n\nReset your password here (valid for 1 hour):\n${appUrl(`/reset?token=${token}`)}\n\nIf you didn't ask for this, you can ignore it — your password hasn't changed.`,
    );
  }
  // Same answer either way so this can't be used to discover accounts.
  return { ok: true };
});

route("POST", "/auth/reset", async ({ request }) => {
  const input = await body(
    request,
    z.object({ token: z.string().min(10).max(200), password: passwordSchema }),
  );
  const sql = await db();
  const rows =
    await sql`update auth_tokens set used_at = now() where token_hash = ${sha256(input.token)} and kind = 'reset_password'
    and used_at is null and expires_at > now() returning user_id`;
  const userId = rows[0]?.["user_id"] as string | undefined;
  if (!userId) throw bad("This reset link has expired or was already used.");
  await sql`update users set password_hash = ${await hashPassword(input.password)} where id = ${userId}`;
  await sql`delete from sessions where user_id = ${userId}`;
  await notify(
    userId,
    "security",
    "Your password was changed",
    "If this wasn't you, contact us right away.",
    "/contact",
  );
  return { ok: true };
});

route("POST", "/auth/change-password", async ({ request }) => {
  const auth = await requireUser(request);
  const input = await body(request, z.object({ current: z.string(), password: passwordSchema }));
  if (!(await verifyPassword(input.current, auth.user.password_hash)))
    throw bad("Your current password isn't right.");
  const sql = await db();
  await sql`update users set password_hash = ${await hashPassword(input.password)} where id = ${auth.user.id}`;
  await sql`delete from sessions where user_id = ${auth.user.id} and id <> ${auth.sessionId}`;
  await notify(
    auth.user.id,
    "security",
    "Your password was changed",
    "Other devices were signed out.",
    "/settings",
  );
  return { ok: true };
});

// ---------------------------------------------------------------- child mode (ages 4–7)
route("POST", "/auth/child-mode/:childId", async ({ request, params }) => {
  const auth = await requireUser(request);
  if (auth.childMode || auth.user.age_group !== "adult") throw forbidden();
  if (!auth.user.parent_pin_hash)
    throw bad("Set a 4-digit parent PIN first, so only you can leave child mode.", "pin_required");
  const sql = await db();
  const rows = await sql<
    UserRow[]
  >`select * from users where id = ${params["childId"]!} and guardian_id = ${auth.user.id} and status = 'active'`;
  const child = rows[0];
  if (!child) throw forbidden("That profile isn't linked to your account.");
  const parentToken = sessionToken(request)!;
  const s = await createSession(child.id, request, { childMode: true, parentId: auth.user.id });
  const headers = new Headers();
  headers.append("set-cookie", s.cookie);
  headers.append("set-cookie", cookie(PARENT_COOKIE, parentToken, 86400));
  return json({ ok: true }, { headers });
});

route("POST", "/auth/exit-child-mode", async ({ request }) => {
  const auth = await requireUser(request);
  if (!auth.childMode || !auth.parentId) throw bad("Not in child mode.");
  const { pin } = await body(request, z.object({ pin: z.string().regex(/^\d{4}$/) }));
  await rateLimit(`pin:${auth.parentId}`, 6, 10 * 60 * 1000);
  const sql = await db();
  const rows = await sql<UserRow[]>`select * from users where id = ${auth.parentId}`;
  if (!rows[0] || !(await verifyPassword(pin, rows[0].parent_pin_hash)))
    throw bad("That PIN isn't right.", "bad_pin");
  const parentToken = sessionToken(request, PARENT_COOKIE);
  await destroySession(sessionToken(request));
  const headers = new Headers();
  const parentSession = parentToken
    ? await sql`select 1 from sessions where token_hash = ${sha256(parentToken)} and user_id = ${auth.parentId} and expires_at > now()`
    : [];
  if (parentToken && parentSession.length) {
    headers.append("set-cookie", cookie(SESSION_COOKIE, parentToken, 30 * 86400));
  } else {
    const s = await createSession(auth.parentId, request);
    headers.append("set-cookie", s.cookie);
  }
  headers.append("set-cookie", cookie(PARENT_COOKIE, "", 0));
  return json({ ok: true }, { headers });
});

route("POST", "/auth/parent-pin", async ({ request }) => {
  const auth = await requireUser(request);
  if (auth.childMode || auth.user.age_group !== "adult") throw forbidden();
  const input = await body(
    request,
    z.object({ pin: z.string().regex(/^\d{4}$/, "Use 4 digits"), password: z.string() }),
  );
  if (!(await verifyPassword(input.password, auth.user.password_hash)))
    throw bad("Your password isn't right.");
  const sql = await db();
  await sql`update users set parent_pin_hash = ${await hashPassword(input.pin)} where id = ${auth.user.id}`;
  return { ok: true };
});
