import { z } from "zod";
import { db } from "../db";
import { requireAdult, requireUser } from "../auth";
import { bad, body, forbidden, rateLimit } from "../http";
import { route } from "../router";
import { awardXp, checkAchievements, isPremium } from "../services";
import { gameById, games } from "@/lib/games-catalog";

async function catalogOverrides() {
  const sql = await db();
  const rows = await sql`select id, enabled, premium from games_catalog`;
  return new Map(rows.map((r) => [r["id"] as string, { enabled: r["enabled"] as boolean, premium: r["premium"] as boolean }]));
}

route("GET", "/games", async ({ request }) => {
  const { user } = await requireUser(request);
  const premium = await isPremium(user);
  const overrides = await catalogOverrides();
  const controls = (user.prefs["controls"] as { games?: boolean } | undefined) ?? {};
  const sql = await db();
  const best = await sql`select game, max(score)::int as best, count(*)::int as plays from game_results where user_id = ${user.id} group by game`;
  const stats = new Map(best.map((b) => [b["game"] as string, { best: b["best"], plays: b["plays"] }]));
  return {
    premium,
    gamesAllowed: !(user.guardian_id && controls.games === false),
    games: games
      .filter((g) => g.ages.includes(user.age_group) && overrides.get(g.id)?.enabled !== false)
      .map((g) => {
        const isPremiumGame = overrides.get(g.id)?.premium ?? g.premium;
        return { ...g, premium: isPremiumGame, locked: isPremiumGame && !premium, stats: stats.get(g.id) ?? null };
      }),
  };
});

route("POST", "/games/results", async ({ request }) => {
  const { user } = await requireUser(request);
  rateLimit(`game:${user.id}`, 120, 60 * 60 * 1000);
  const input = await body(
    request,
    z.object({ game: z.string().max(30), difficulty: z.enum(["easy", "medium", "hard"]), score: z.number().int().min(0).max(100000), durationS: z.number().int().min(0).max(7200) }),
  );
  const def = gameById[input.game];
  if (!def || !def.ages.includes(user.age_group)) throw bad("Unknown game.");
  const overrides = await catalogOverrides();
  if ((overrides.get(def.id)?.premium ?? def.premium) && !(await isPremium(user))) throw forbidden("This game is part of Premium.", "premium_required");
  const sql = await db();
  await sql`insert into game_results (user_id, game, difficulty, score, duration_s) values (${user.id}, ${def.id}, ${input.difficulty}, ${def.ranked ? input.score : 0}, ${input.durationS})`;
  const xp = await awardXp(user.id, 15, `game:${def.id}`);
  await checkAchievements(user.id);
  const [best] = await sql`select max(score)::int as best from game_results where user_id = ${user.id} and game = ${def.id} and difficulty = ${input.difficulty}`;
  return { xp, best: best?.["best"] ?? 0 };
});

/**
 * Leaderboards: adults only, Premium only, opt-in only, pseudonyms only.
 * Minors are never ranked and never appear here.
 */
route("GET", "/leaderboard", async ({ request, url }) => {
  const { user } = await requireAdult(request);
  const premium = await isPremium(user);
  const game = url.searchParams.get("game") ?? "memory";
  const period = url.searchParams.get("period") ?? "week";
  const def = gameById[game];
  if (!def?.ranked) throw bad("That game doesn't have a leaderboard.");
  const interval = period === "day" ? "1 day" : period === "month" ? "30 days" : "7 days";
  const sql = await db();
  const rows = await sql`
    select coalesce(nullif(u.prefs->>'leaderboardAlias',''), 'Gardener ' || substr(u.id::text, 1, 4)) as alias,
      u.avatar_style, max(r.score)::int as score, (u.id = ${user.id}) as me
    from game_results r join users u on u.id = r.user_id
    where r.game = ${game} and r.created_at > now() - ${interval}::interval
      and u.age_group = 'adult' and u.status = 'active' and (u.prefs->>'leaderboardOptIn')::boolean is true
      and exists (select 1 from subscriptions s where s.user_id = u.id and s.status in ('active','trialing','past_due') and (s.current_period_end is null or s.current_period_end > now()))
    group by u.id order by score desc limit 50`;
  return { premium, optedIn: user.prefs["leaderboardOptIn"] === true, game, period, rows: premium ? rows : [] };
});
