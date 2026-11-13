import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { AppShell } from "@/components/app-shell";
import { Card, LoadingCards, PageHeader, ProgressRing } from "@/components/kit";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/achievements")({
  head: () => ({ meta: [{ title: "Achievements — Pause." }] }),
  component: Achievements,
});

function Achievements() {
  const q = useQuery({ queryKey: ["achievements"], queryFn: () => api("/achievements") });
  const today = useQuery({ queryKey: ["today-ach"], queryFn: () => api("/me/today") });
  const list: any[] = q.data?.achievements ?? [];
  const earned = list.filter((a) => a.earnedAt).length;
  return (
    <AppShell title="Achievements" wide>
      <PageHeader
        eyebrow="Your journey"
        title="Achievements"
        subtitle="Rewards for showing up and trying things — never for how you feel. Hard days count just as much."
      />
      {q.isLoading ? (
        <LoadingCards n={2} />
      ) : (
        <>
          <Card className="mb-6 flex flex-wrap items-center gap-6">
            <ProgressRing value={today.data?.progress ?? 0} size={110} stroke={10}>
              <span className="text-lg">Lv {q.data.level}</span>
            </ProgressRing>
            <div>
              <p className="font-display text-4xl font-black">{q.data.xp} XP</p>
              <p className="text-muted-foreground">
                {q.data.xpToday} today (gently capped each day, so there's no reason to overdo it) ·{" "}
                {earned}/{list.length} badges
              </p>
            </div>
          </Card>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {list.map((a, i) => (
              <motion.div
                key={a.key}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.03 }}
                className={cn(
                  "card-soft flex flex-col items-center p-5 text-center",
                  !a.earnedAt && "opacity-55 grayscale",
                )}
              >
                <span
                  className={cn(
                    "grid size-16 place-items-center rounded-full text-4xl",
                    a.earnedAt ? "bg-mustard" : "bg-muted",
                  )}
                  aria-hidden="true"
                >
                  {a.emoji}
                </span>
                <p className="mt-3 font-display text-lg font-bold">{a.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{a.body}</p>
                <p className="mt-2 text-xs font-bold text-forest">
                  {a.earnedAt ? `Earned ${new Date(a.earnedAt).toLocaleDateString()}` : "Not yet"}
                </p>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </AppShell>
  );
}
