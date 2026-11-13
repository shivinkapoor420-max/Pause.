import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Lock, Trophy } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge, EmptyState, LoadingCards, PageHeader } from "@/components/kit";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/games/")({
  head: () => ({ meta: [{ title: "Games — Pause." }] }),
  component: GamesCentre,
});

function GamesCentre() {
  const { user } = useSession();
  const q = useQuery({ queryKey: ["games"], queryFn: () => api("/games"), enabled: !!user });
  const games: any[] = q.data?.games ?? [];
  const kid = user?.ageGroup === "early" || user?.ageGroup === "kids";
  return (
    <AppShell title="Games" wide>
      <PageHeader
        eyebrow="Games Centre"
        title={kid ? "Let's play! 🎈" : "Calm games"}
        subtitle={
          kid
            ? "Fun games to help your body and brain feel calm. You can't lose any of them!"
            : "Short, gentle games for focus and calm. Nothing here is about winning at feelings."
        }
        action={
          user?.ageGroup === "adult" ? (
            <Link
              to="/leaderboard"
              className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-card px-4 py-2 text-sm font-bold"
            >
              <Trophy className="size-4" /> Leaderboards
            </Link>
          ) : undefined
        }
      />
      {q.isLoading ? (
        <LoadingCards n={4} />
      ) : q.data && !q.data.gamesAllowed ? (
        <EmptyState
          emoji="🌙"
          title="Games are resting for now"
          body="Your grown-up has paused games. Try a breathing exercise or draw in your journal instead."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((g, i) => (
            <motion.div
              key={g.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Link
                to={g.locked ? "/billing" : "/games/$id"}
                params={g.locked ? undefined : ({ id: g.id } as never)}
                className="lift relative block h-full overflow-hidden rounded-3xl border-2 border-ink bg-card"
              >
                <div
                  className="relative grid h-32 place-items-center"
                  style={{
                    background: `linear-gradient(135deg, oklch(0.9 0.09 ${g.hue}), oklch(0.78 0.13 ${g.hue + 50}))`,
                  }}
                >
                  <span className={kid ? "float-slow text-7xl" : "text-6xl"} aria-hidden="true">
                    {g.emoji}
                  </span>
                  {g.locked && (
                    <span className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-ink/80 px-2.5 py-1 text-xs font-bold text-card">
                      <Lock className="size-3" /> Premium
                    </span>
                  )}
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-display text-xl font-bold">{g.title}</h2>
                    {g.premium && !g.locked && <Badge tone="premium">Premium</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{g.blurb}</p>
                  {g.stats && (
                    <p className="mt-3 text-xs font-bold text-forest">
                      Played {g.stats.plays}×{" "}
                      {g.ranked && g.stats.best > 0 ? `· best ${g.stats.best}` : ""}
                    </p>
                  )}
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
