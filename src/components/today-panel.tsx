import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { BookOpen, Check, Gamepad2, Heart, Sun, Wind } from "lucide-react";
import { ProgressRing } from "@/components/kit";
import { api } from "@/lib/api";
import { useApp } from "@/lib/app-state";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";

type Today = {
  checked_in: boolean;
  journaled: boolean;
  breathed: boolean;
  played: boolean;
  xp: number;
  level: number;
  progress: number;
  days_showed_up: number;
};

export function TodayPanel() {
  const { user } = useSession();
  const { state } = useApp();
  const today = useQuery({
    queryKey: ["today", state.moods.length, state.journal.length],
    queryFn: () => api<Today>("/me/today"),
  });
  if (!user) return null;
  const g = user.ageGroup;
  const t = today.data;
  const quests = [
    {
      done: !!t?.checked_in,
      label: g === "kids" ? "Pick today's weather" : "Check in",
      icon: Sun,
      to: "#mood",
    },
    {
      done: !!t?.breathed,
      label: g === "kids" ? "Do a calm breath" : "One mindful minute",
      icon: Wind,
      to: "/tools",
    },
    {
      done: !!t?.journaled,
      label: g === "kids" ? "Draw or write" : "Write a few lines",
      icon: BookOpen,
      to: "/journal",
    },
    { done: !!t?.played, label: "Play a calm game", icon: Gamepad2, to: "/games" },
  ];
  const doneCount = quests.filter((q) => q.done).length;
  const actions = [
    ...(g !== "early"
      ? [{ to: "/companion", label: "Talk to Pip", icon: Heart, tone: "bg-blush" }]
      : []),
    { to: "/tools", label: "Breathe", icon: Wind, tone: "bg-primary" },
    { to: "/journal", label: "Journal", icon: BookOpen, tone: "bg-lavender" },
    { to: "/games", label: "Games", icon: Gamepad2, tone: "bg-mustard" },
  ];

  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-[1.3fr_1fr]">
      <section className="card-soft p-5" aria-labelledby="quests">
        <div className="flex items-center justify-between">
          <h3 id="quests" className="font-display text-xl font-bold">
            {g === "kids" ? "Today's mini-quests" : "Today's gentle goals"}
          </h3>
          <span className="text-sm font-bold text-muted-foreground">{doneCount}/4</span>
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-2">
          {quests.map((q) => (
            <li key={q.label}>
              {q.to.startsWith("#") ? (
                <a
                  href={q.to}
                  className={cn(
                    "flex items-center gap-2 rounded-2xl border-2 p-3 text-sm font-bold transition-colors",
                    q.done
                      ? "border-forest bg-primary/60"
                      : "border-dashed border-border hover:bg-muted",
                  )}
                >
                  <QuestIcon done={q.done} icon={q.icon} />
                  {q.label}
                </a>
              ) : (
                <Link
                  to={q.to}
                  className={cn(
                    "flex items-center gap-2 rounded-2xl border-2 p-3 text-sm font-bold transition-colors",
                    q.done
                      ? "border-forest bg-primary/60"
                      : "border-dashed border-border hover:bg-muted",
                  )}
                >
                  <QuestIcon done={q.done} icon={q.icon} />
                  {q.label}
                </Link>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Any one of these is plenty. There's no streak to lose here.
        </p>
      </section>
      <section className="card-soft flex items-center gap-4 p-5">
        <ProgressRing value={t?.progress ?? 0} size={84}>
          Lv {t?.level ?? 1}
        </ProgressRing>
        <div>
          <p className="font-display text-xl font-bold">{t ? `${t.xp} XP` : "…"}</p>
          <p className="text-sm text-muted-foreground">
            {t
              ? `You've shown up on ${t.days_showed_up} day${t.days_showed_up === 1 ? "" : "s"}.`
              : ""}
          </p>
          <Link
            to="/achievements"
            className="mt-1 inline-block text-sm font-bold text-forest underline"
          >
            Achievements
          </Link>
        </div>
      </section>
      <nav aria-label="Quick actions" className="grid grid-cols-4 gap-2 sm:col-span-2">
        {actions.map((a, i) => (
          <motion.div
            key={a.to}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Link
              to={a.to}
              className={cn(
                "lift flex flex-col items-center gap-1.5 rounded-3xl border-2 border-ink p-3 text-center text-xs font-bold sm:text-sm",
                a.tone,
              )}
            >
              <a.icon className="size-6" aria-hidden="true" />
              {a.label}
            </Link>
          </motion.div>
        ))}
      </nav>
    </div>
  );
}

function QuestIcon({ done, icon: Icon }: { done: boolean; icon: typeof Sun }) {
  return (
    <span
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-full",
        done ? "bg-forest text-forest-foreground" : "bg-muted",
      )}
    >
      {done ? <Check className="size-4" /> : <Icon className="size-4" />}
    </span>
  );
}
