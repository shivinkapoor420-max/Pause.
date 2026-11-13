import { Link, createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useCallback, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { AppShell, PillButton } from "@/components/app-shell";
import { EmptyState } from "@/components/kit";
import { gameComponents, type Difficulty } from "@/components/games/games";
import { api } from "@/lib/api";
import { gameById } from "@/lib/games-catalog";
import { useApp } from "@/lib/app-state";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/games/$id")({
  head: () => ({ meta: [{ title: "Play — Pause." }] }),
  component: PlayGame,
});

function PlayGame() {
  const { id } = Route.useParams();
  const { user } = useSession();
  const { addJournal } = useApp();
  const qc = useQueryClient();
  const def = gameById[id];
  const young = user?.ageGroup === "early";
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [phase, setPhase] = useState<"intro" | "play" | "done">("intro");
  const [result, setResult] = useState<{
    score: number;
    summary: string;
    xp?: number;
    best?: number;
    drawing?: string;
    error?: string;
  } | null>(null);
  const [runKey, setRunKey] = useState(0);
  const startedAt = useRef(Date.now());

  const onFinish = useCallback(
    async (score: number, summary: string, extra?: { drawing?: string }) => {
      setPhase("done");
      setResult({ score, summary, ...(extra?.drawing ? { drawing: extra.drawing } : {}) });
      try {
        const r = await api<{ xp: number; best: number }>("/games/results", {
          body: {
            game: id,
            difficulty,
            score,
            durationS: Math.round((Date.now() - startedAt.current) / 1000),
          },
        });
        setResult((x) => (x ? { ...x, xp: r.xp, best: r.best } : x));
        void qc.invalidateQueries({ queryKey: ["games"] });
      } catch (e) {
        setResult((x) =>
          x ? { ...x, error: e instanceof Error ? e.message : "Couldn't save" } : x,
        );
      }
    },
    [id, difficulty, qc],
  );

  if (!def || !user || !def.ages.includes(user.ageGroup)) {
    return (
      <AppShell title="Game">
        <EmptyState
          emoji="🧩"
          title="That game isn't here"
          action={
            <Link to="/games" className="font-bold underline">
              Back to games
            </Link>
          }
        />
      </AppShell>
    );
  }
  const Game = gameComponents[id]!;
  const levels = young ? (["easy"] as Difficulty[]) : def.difficulties;

  return (
    <AppShell title={def.title} wide>
      <Link
        to={user.childMode ? "/kid" : "/games"}
        className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {user.childMode ? "Back" : "All games"}
      </Link>
      <div className="flex items-center gap-4">
        <span
          className="grid size-16 place-items-center rounded-2xl text-4xl"
          style={{
            background: `linear-gradient(135deg, oklch(0.9 0.09 ${def.hue}), oklch(0.78 0.13 ${def.hue + 50}))`,
          }}
          aria-hidden="true"
        >
          {def.emoji}
        </span>
        <div>
          <h1 className="font-display text-3xl font-black">{def.title}</h1>
          <p className="text-muted-foreground">{def.blurb}</p>
        </div>
      </div>

      <div className="mt-6">
        {phase === "intro" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-soft mx-auto max-w-lg p-6"
          >
            <h2 className="font-display text-xl font-bold">How to play</h2>
            <p className="mt-2">{def.how}</p>
            {levels.length > 1 && (
              <>
                <p className="mt-5 text-sm font-bold">Choose a level</p>
                <div className="mt-2 flex gap-2">
                  {levels.map((d) => (
                    <button
                      key={d}
                      onClick={() => setDifficulty(d)}
                      aria-pressed={difficulty === d}
                      className={cn(
                        "flex-1 rounded-2xl border-2 py-2.5 font-bold capitalize",
                        difficulty === d ? "border-ink bg-mustard" : "border-border bg-card",
                      )}
                    >
                      {d === "easy" ? "Gentle" : d === "medium" ? "Steady" : "Stretch"}
                    </button>
                  ))}
                </div>
              </>
            )}
            <PillButton
              variant="coral"
              className="mt-6 w-full"
              onClick={() => {
                startedAt.current = Date.now();
                setPhase("play");
              }}
            >
              Start
            </PillButton>
          </motion.div>
        )}

        {phase === "play" && (
          <Game
            key={runKey}
            difficulty={difficulty}
            young={young || user.ageGroup === "kids"}
            onFinish={onFinish}
          />
        )}

        {phase === "done" && result && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card-soft mx-auto max-w-lg p-8 text-center"
          >
            <p className="pop-in text-6xl">{young ? "🌟" : "🌿"}</p>
            <h2 className="mt-3 font-display text-3xl font-black">
              {young ? "Amazing job!" : "Nicely done"}
            </h2>
            <p className="mt-2 text-muted-foreground">{result.summary}</p>
            {def.ranked && result.score > 0 && (
              <p className="mt-4 font-display text-4xl font-black text-forest">{result.score}</p>
            )}
            {result.best !== undefined && def.ranked && result.best > 0 && (
              <p className="text-sm font-bold text-muted-foreground">Your best: {result.best}</p>
            )}
            {result.xp !== undefined && result.xp > 0 && (
              <p className="mt-2 text-sm font-bold text-forest">
                +{result.xp} XP · your garden grew a little 🌱
              </p>
            )}
            {result.error && (
              <p className="mt-2 text-sm font-bold text-destructive">{result.error}</p>
            )}
            {result.drawing && (
              <>
                <img
                  src={result.drawing}
                  alt="Your colouring"
                  className="mx-auto mt-4 w-48 rounded-2xl border-2 border-ink"
                />
                <PillButton
                  variant="outline"
                  className="mt-3"
                  onClick={() => {
                    addJournal({ kind: "drawing", prompt: `Colour Calm`, body: result.drawing! });
                    setResult({ ...result, drawing: undefined as never });
                  }}
                >
                  Save to my journal
                </PillButton>
              </>
            )}
            <div className="mt-6 flex justify-center gap-2">
              <PillButton
                variant="coral"
                onClick={() => {
                  setResult(null);
                  setRunKey((k) => k + 1);
                  startedAt.current = Date.now();
                  setPhase("play");
                }}
              >
                Play again
              </PillButton>
              <Link to={user.childMode ? "/kid" : "/games"}>
                <PillButton variant="outline">{user.childMode ? "Back" : "More games"}</PillButton>
              </Link>
            </div>
          </motion.div>
        )}
      </div>
    </AppShell>
  );
}
