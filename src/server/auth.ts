import { db, env } from "./db";
import { randomToken, sha256 } from "./crypto";
import { forbidden, unauthorized } from "./http";

export type AgeGroup = "early" | "kids" | "teen" | "adult";
export type Role = "user" | "moderator" | "admin";

export type UserRow = {
  id: string;
  email: string | null;
  email_verified_at: Date | null;
  username: string;
  password_hash: string | null;
  display_name: string;
  birth_date: Date | string;
  age_group: AgeGroup;
  role: Role;
  guardian_id: string | null;
  parent_pin_hash: string | null;
  bio: string;
  avatar_id: string | null;
  cover_id: string | null;
  avatar_style: string;
  interests: string[];
  profile_visibility: "public" | "followers" | "private";
  phone: string;
  community_alias: string | null;
  identity_mode: "alias" | "name";
  settings: Record<string, unknown>;
  prefs: Record<string, unknown>;
  app_data: Record<string, unknown>;
  consented_at: Date | null;
  memory_consent: boolean;
  status: "active" | "suspended" | "deleted";
  created_at: Date;
};

export type Auth = {
  user: UserRow;
  sessionId: string;
  childMode: boolean;
  parentId: string | null;
};

export const SESSION_COOKIE = "pause_sid";
export const PARENT_COOKIE = "pause_psid";
const SESSION_DAYS = 30;

export function ageInYears(birth: Date | string, now = new Date()) {
  const b = typeof birth === "string" ? new Date(`${birth.slice(0, 10)}T00:00:00Z`) : birth;
  let age = now.getUTCFullYear() - b.getUTCFullYear();
  const m = now.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < b.getUTCDate())) age--;
  return age;
}

export function groupForAge(age: number): AgeGroup | null {
  if (age < 4 || age > 120) return null;
  if (age <= 7) return "early";
  if (age <= 12) return "kids";
  if (age <= 17) return "teen";
  return "adult";
}

function parseCookies(request: Request) {
  const out: Record<string, string> = {};
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function secure() {
  return env("NODE_ENV") === "production" || env("APP_URL").startsWith("https://");
}

export function cookie(name: string, value: string, maxAgeSeconds: number) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure() ? "; Secure" : ""}`;
}

export async function createSession(
  userId: string,
  request: Request,
  opts: { childMode?: boolean; parentId?: string | null } = {},
) {
  const sql = await db();
  const token = randomToken();
  const days = opts.childMode ? 1 : SESSION_DAYS;
  await sql`insert into sessions (token_hash, user_id, child_mode, parent_id, user_agent, expires_at)
    values (${sha256(token)}, ${userId}, ${opts.childMode ?? false}, ${opts.parentId ?? null},
      ${(request.headers.get("user-agent") ?? "").slice(0, 200)}, now() + ${`${days} days`}::interval)`;
  return { token, cookie: cookie(SESSION_COOKIE, token, days * 86400) };
}

export async function destroySession(token: string | undefined) {
  if (!token) return;
  const sql = await db();
  await sql`delete from sessions where token_hash = ${sha256(token)}`;
}

export function sessionToken(request: Request, name = SESSION_COOKIE) {
  return parseCookies(request)[name];
}

export async function getAuth(request: Request): Promise<Auth | null> {
  const token = sessionToken(request);
  if (!token) return null;
  const sql = await db();
  const rows = await sql<
    (UserRow & { sid: string; child_mode: boolean; parent_id: string | null })[]
  >`
    select u.*, s.id as sid, s.child_mode, s.parent_id from sessions s join users u on u.id = s.user_id
    where s.token_hash = ${sha256(token)} and s.expires_at > now() and u.status = 'active'`;
  const row = rows[0];
  if (!row) return null;
  // Children grow up: keep the age group current so permissions follow the birthday.
  const group = groupForAge(ageInYears(row.birth_date));
  if (group && group !== row.age_group) {
    await sql`update users set age_group = ${group} where id = ${row.id}`;
    row.age_group = group;
  }
  const { sid, child_mode, parent_id, ...user } = row;
  return { user: user as UserRow, sessionId: sid, childMode: child_mode, parentId: parent_id };
}

export async function requireUser(request: Request) {
  const auth = await getAuth(request);
  if (!auth) throw unauthorized();
  return auth;
}

/** Adult community, messaging and leaderboards. Enforced on every request, server-side. */
export async function requireAdult(request: Request) {
  const auth = await requireUser(request);
  if (auth.user.age_group !== "adult" || auth.childMode) {
    throw forbidden("The Pause community is for adults (18+) only.", "adults_only");
  }
  return auth;
}

export async function requireVerifiedAdult(request: Request) {
  const auth = await requireAdult(request);
  if (!auth.user.email_verified_at && env("REQUIRE_EMAIL_VERIFICATION", "true") !== "false") {
    throw forbidden("Please verify your email address to join the community.", "email_unverified");
  }
  return auth;
}

export async function requireAdmin(request: Request) {
  const auth = await requireUser(request);
  if (auth.user.role !== "admin" || auth.childMode)
    throw forbidden("Administrators only.", "admin_only");
  return auth;
}

export async function requireStaff(request: Request) {
  const auth = await requireUser(request);
  if ((auth.user.role !== "admin" && auth.user.role !== "moderator") || auth.childMode) {
    throw forbidden("Moderators only.", "staff_only");
  }
  return auth;
}

/** The signed-in adult must be the guardian of `childId`. */
export async function requireGuardianOf(request: Request, childId: string) {
  const auth = await requireUser(request);
  if (auth.childMode || auth.user.age_group !== "adult") throw forbidden();
  const sql = await db();
  const rows = await sql<
    UserRow[]
  >`select * from users where id = ${childId} and guardian_id = ${auth.user.id} and status = 'active'`;
  if (!rows[0]) throw forbidden("That profile isn't linked to your account.");
  return { auth, child: rows[0] };
}

/** Shape sent to the browser about the signed-in user. Never includes hashes. */
export function selfView(u: UserRow, extra: { childMode?: boolean; premium?: boolean } = {}) {
  return {
    id: u.id,
    email: u.email,
    emailVerified: !!u.email_verified_at,
    username: u.username,
    displayName: u.display_name,
    ageGroup: u.age_group,
    role: u.role,
    guardianId: u.guardian_id,
    hasParentPin: !!u.parent_pin_hash,
    bio: u.bio,
    avatarId: u.avatar_id,
    coverId: u.cover_id,
    avatarStyle: u.avatar_style,
    interests: u.interests,
    profileVisibility: u.profile_visibility,
    phone: u.phone,
    communityAlias: u.community_alias,
    identityMode: u.identity_mode,
    settings: u.settings,
    prefs: u.prefs,
    consented: !!u.consented_at,
    memoryConsent: u.memory_consent,
    childMode: extra.childMode ?? false,
    premium: extra.premium ?? false,
    createdAt: u.created_at,
    birthDate:
      typeof u.birth_date === "string"
        ? u.birth_date.slice(0, 10)
        : u.birth_date.toISOString().slice(0, 10),
  };
}

export async function audit(
  actorId: string | null,
  action: string,
  target = "",
  meta: Record<string, unknown> = {},
  ip = "",
) {
  const sql = await db();
  await sql`insert into audit_logs (actor_id, action, target, meta, ip) values (${actorId}, ${action}, ${target}, ${sql.json(meta as never)}, ${ip})`;
}

/** The name other community members see: a pseudonym unless the person chose otherwise. */
export function publicName(u: Pick<UserRow, "identity_mode" | "display_name" | "community_alias">) {
  return u.identity_mode === "name" ? u.display_name : (u.community_alias ?? "Member");
}

const aliasA = [
  "Quiet",
  "Gentle",
  "Steady",
  "Soft",
  "Brave",
  "Calm",
  "Kind",
  "Bright",
  "Still",
  "Warm",
  "Hopeful",
  "Patient",
  "Rising",
  "Mellow",
  "Clear",
];
const aliasB = [
  "Fern",
  "River",
  "Willow",
  "Harbor",
  "Meadow",
  "Cedar",
  "Sparrow",
  "Lantern",
  "Pebble",
  "Tide",
  "Maple",
  "Comet",
  "Moss",
  "Heron",
  "Ember",
];

export function generateAlias() {
  const a = aliasA[Math.floor(Math.random() * aliasA.length)]!;
  const b = aliasB[Math.floor(Math.random() * aliasB.length)]!;
  return `${a}${b}_${Math.floor(100 + Math.random() * 900)}`;
}
