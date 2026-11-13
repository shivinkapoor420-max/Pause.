import postgres from "postgres";
import { hashPassword } from "./crypto";

/**
 * One shared Postgres pool per server process. Works against local Postgres,
 * Supabase (use the "Session pooler" / direct connection string), Neon or RDS.
 */
type Sql = postgres.Sql<Record<string, never>>;

const g = globalThis as unknown as {
  __pauseSql?: Sql;
  __pauseMigrated?: Promise<void> | undefined;
};

export function env(name: string, fallback = ""): string {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

export function getSql(): Sql {
  if (!g.__pauseSql) {
    const url = env("DATABASE_URL");
    if (!url)
      throw new Error("DATABASE_URL is not set. Copy .env.example to .env and configure it.");
    g.__pauseSql = postgres(url, {
      max: Number(env("DATABASE_POOL_SIZE", "10")),
      idle_timeout: 30,
      ssl: env("DATABASE_SSL") === "require" ? "require" : false,
      onnotice: () => {},
      transform: { undefined: null },
    }) as unknown as Sql;
  }
  return g.__pauseSql;
}

const migrations = import.meta.glob("../../db/migrations/*.sql", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

/** Applies pending SQL migrations once per process, then seeds essentials. */
export function ready(): Promise<void> {
  if (!g.__pauseMigrated) {
    g.__pauseMigrated = (async () => {
      const sql = getSql();
      await sql`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
      const done = new Set(
        (await sql<{ name: string }[]>`select name from schema_migrations`).map((r) => r.name),
      );
      for (const [path, text] of Object.entries(migrations).sort(([a], [b]) =>
        a.localeCompare(b),
      )) {
        const name = path.split("/").pop()!;
        if (done.has(name)) continue;
        await sql.begin(async (tx) => {
          await tx.unsafe(text);
          await tx`insert into schema_migrations (name) values (${name})`;
        });
        console.info(`[db] applied migration ${name}`);
      }
      await seed();
      await ensureAliases();
    })().catch((e) => {
      g.__pauseMigrated = undefined;
      throw e;
    });
  }
  return g.__pauseMigrated;
}

const defaultCommunities: [string, string, string, number][] = [
  [
    "anxiety-stress",
    "Anxiety & Stress Support",
    "A gentle space to talk about worry, pressure and the days that feel like too much.",
    260,
  ],
  [
    "better-sleep",
    "Better Sleep",
    "Wind-down routines, restless nights and what helps you rest.",
    230,
  ],
  [
    "mindfulness",
    "Mindfulness & Meditation",
    "Practices, questions and quiet wins from sitting still.",
    150,
  ],
  [
    "personal-growth",
    "Personal Growth",
    "Small steps, honest reflections, becoming more yourself.",
    40,
  ],
  ["student-life", "Student Life", "Exams, deadlines, moving away and everything in between.", 200],
  [
    "work-burnout",
    "Work Stress & Burnout",
    "Boundaries, recovery and being more than your job.",
    20,
  ],
  [
    "journaling",
    "Journaling & Creativity",
    "Prompts, pages, art and making things to feel better.",
    320,
  ],
  [
    "gratitude",
    "Gratitude & Positivity",
    "Noticing the good without pretending the hard stuff isn't there.",
    85,
  ],
  [
    "recovery",
    "Recovery & Sobriety",
    "One day at a time. Share milestones, hard days and what's keeping you going — anonymously if you like.",
    175,
  ],
  [
    "one-day-at-a-time",
    "Cravings & Hard Days",
    "For the moments that test you. Reach out before, during or after — no judgement here.",
    10,
  ],
  [
    "families-recovery",
    "Families & Loved Ones",
    "For people supporting someone in recovery — and looking after themselves too.",
    300,
  ],
  [
    "fitness-wellness",
    "Fitness & Mental Wellness",
    "Moving your body for your mind — at any pace.",
    120,
  ],
];

const guidelines = `1. Be kind. Everyone here is carrying something.
2. Peer support, not professional advice. Nobody here is your therapist, and Pause. is not a clinical service.
3. No harassment, hate, sexual content, or encouragement of self-harm.
4. No spam, selling or self-promotion.
5. Anonymity is protected here. Never try to identify, out or contact anyone outside Pause. What's shared here stays here.
6. Don't share identifying details — yours or anyone else's (full names, workplaces, meeting locations).
7. If you're in crisis, use the help resources pinned in the app. Please reach out.`;

async function seed() {
  const sql = getSql();
  for (const [slug, name, description, hue] of defaultCommunities) {
    await sql`insert into communities (slug, name, description, guidelines, cover_hue)
      values (${slug}, ${name}, ${description}, ${guidelines}, ${hue}) on conflict (slug) do nothing`;
  }
  // Master admin account, created from environment variables only (never hard-coded).
  const email = env("ADMIN_EMAIL").toLowerCase();
  const password = env("ADMIN_PASSWORD");
  if (email && password) {
    const existing = await sql`select id, role from users where email = ${email}`;
    if (existing.length === 0) {
      await sql`insert into users (email, email_verified_at, username, community_alias, password_hash, display_name, birth_date, age_group, role, consented_at)
        values (${email}, now(), ${env("ADMIN_USERNAME", "pause_admin")}, ${"PauseTeam"}, ${await hashPassword(password)}, ${"Pause Admin"}, ${"1990-01-01"}, ${"adult"}, ${"admin"}, now())
        on conflict do nothing`;
      console.info("[db] master admin account created from ADMIN_EMAIL");
    } else if (existing[0]!["role"] !== "admin") {
      await sql`update users set role = 'admin' where email = ${email}`;
    }
  }
}

export async function db() {
  await ready();
  return getSql();
}

/** Backfill a pseudonym for any adult account that doesn't have one yet. */
export async function ensureAliases() {
  const sql = getSql();
  const { generateAlias } = await import("./auth");
  const rows =
    await sql`select id from users where community_alias is null and age_group = 'adult'`;
  for (const r of rows)
    await sql`update users set community_alias = ${generateAlias() + String(r["id"]).slice(0, 2)} where id = ${r["id"]}`;
}
