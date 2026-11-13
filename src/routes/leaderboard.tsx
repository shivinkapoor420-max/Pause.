import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, PillButton } from "@/components/app-shell";
import { Avatar, Card, EmptyState, LoadingCards, PageHeader, Tabs } from "@/components/kit";
import { api } from "@/lib/api";
import { games } from "@/lib/games-catalog";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({ meta: [{ title: "Leaderboards — Pause." }] }),
  component: Leaderboard,
});

const ranked = games.filter((g) => g.ranked && g.ages.includes("adult"));

function Leaderboard() {
  const { user, refresh } = useSession();
  const [game, setGame] = useState(ranked[0]!.id);
  const [period, setPeriod] = useState<"day" | "week" | "month">("week");
  const q = useQuery({
    queryKey: ["leaderboard", game, period],
    queryFn: () => api(`/leaderboard?game=${game}&period=${period}`),
    enabled: user?.ageGroup === "adult",
    retry: false,
  });

  if (user && user.ageGroup !== "adult") {
    return (
      <AppShell title="Leaderboards">
        <EmptyState
          emoji="🌱"
          title="Your progress is just yours"
          body="Leaderboards are for adult members. Check your achievements and garden instead!"
          action={
            <Link to="/achievements" className="font-bold underline">
              My achievements
            </Link>
          }
        />
      </AppShell>
    );
  }
  const optIn = async (v: boolean) => {
    await api("/me", { method: "PATCH", body: { prefs: { leaderboardOptIn: v } } });
    await refresh();
    await q.refetch();
    toast.success(
      v ? "You're on the boards — under your pseudonym" : "You've left the leaderboards",
    );
  };

  return (
    <AppShell title="Leaderboards" wide>
      <PageHeader
        eyebrow="Premium · opt-in · adults only"
        title="Leaderboards"
        subtitle="Friendly rankings for skill games only — never for feelings, breathing or check-ins. Pseudonyms only."
      />
      {!user?.premium ? (
        <EmptyState
          emoji="🏆"
          title="Leaderboards are part of Premium"
          body="Opt in to see where your focus and memory games rank — anonymously."
          action={
            <Link to="/pricing" className="font-bold underline">
              See Premium
            </Link>
          }
        />
      ) : (
        <>
          <Card className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="font-semibold">
              {q.data?.optedIn
                ? "You're taking part under your pseudonym."
                : "You're not on the leaderboards. Your scores stay private until you opt in."}
            </p>
            <PillButton
              variant={q.data?.optedIn ? "outline" : "forest"}
              onClick={() => void optIn(!q.data?.optedIn)}
            >
              {q.data?.optedIn ? "Leave leaderboards" : "Opt in"}
            </PillButton>
          </Card>
          <div className="mb-4 flex flex-wrap gap-2">
            {ranked.map((g) => (
              <button
                key={g.id}
                onClick={() => setGame(g.id)}
                aria-pressed={game === g.id}
                className={cn(
                  "rounded-full border-2 px-4 py-2 text-sm font-bold",
                  game === g.id ? "border-ink bg-mustard" : "border-border bg-card",
                )}
              >
                {g.emoji} {g.title}
              </button>
            ))}
          </div>
          <Tabs
            className="mb-5 w-fit"
            value={period}
            onChange={setPeriod}
            items={[
              { id: "day", label: "Today" },
              { id: "week", label: "This week" },
              { id: "month", label: "This month" },
            ]}
          />
          {q.isLoading ? (
            <LoadingCards n={3} />
          ) : (q.data?.rows ?? []).length === 0 ? (
            <EmptyState
              emoji="🌾"
              title="No scores yet"
              body="Be the first — play a round and opt in."
            />
          ) : (
            <ol className="space-y-2">
              {q.data.rows.map((r: any, i: number) => (
                <li
                  key={i}
                  className={cn(
                    "card-soft flex items-center gap-4 p-4",
                    r.me && "border-2 border-forest",
                  )}
                >
                  <span className="w-8 text-center font-display text-2xl font-black">
                    {i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}
                  </span>
                  <Avatar style={r.avatar_style} size={36} />
                  <span className="flex-1 font-bold">
                    {r.alias} {r.me && <span className="text-xs text-forest">(you)</span>}
                  </span>
                  <span className="font-display text-xl font-black">{r.score}</span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </AppShell>
  );
}
