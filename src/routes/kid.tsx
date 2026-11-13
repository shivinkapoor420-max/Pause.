import { Link, createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { buildGarden } from "@/lib/garden";
import { api } from "@/lib/api";
import { speak, today, useApp, type Sky } from "@/lib/app-state";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/kid")({
  head: () => ({ meta: [{ title: "Play & calm — Pause." }] }),
  component: KidHome,
});

const feelings: { emoji: string; label: string; sky: Sky; color: string; say: string }[] = [
  {
    emoji: "😊",
    label: "Happy",
    sky: "sunny",
    color: "bg-mustard",
    say: "You feel happy! That's lovely. What made you smile?",
  },
  {
    emoji: "😌",
    label: "Calm",
    sky: "partly",
    color: "bg-primary",
    say: "You feel calm, like a quiet pond.",
  },
  {
    emoji: "😐",
    label: "Meh",
    sky: "cloudy",
    color: "bg-muted",
    say: "Feeling meh is okay. Some days are cloudy.",
  },
  {
    emoji: "😢",
    label: "Sad",
    sky: "rainy",
    color: "bg-lavender",
    say: "You feel sad. That's okay. A grown-up can give you a hug.",
  },
  {
    emoji: "😠",
    label: "Cross",
    sky: "stormy",
    color: "bg-coral",
    say: "You feel cross. Let's take a big dragon breath together.",
  },
  {
    emoji: "😨",
    label: "Scared",
    sky: "stormy",
    color: "bg-blush",
    say: "You feel scared. You are safe. Let's breathe slowly together.",
  },
];

const stories = [
  {
    title: "The Sleepy Turtle",
    emoji: "🐢",
    pages: [
      "Tilly the turtle was very, very sleepy.",
      "She took a big slow breath in… and a long slow breath out.",
      "She tucked her head inside her cosy shell.",
      "The waves went whoosh… whoosh… whoosh.",
      "And Tilly drifted off to sleep. Goodnight, Tilly.",
    ],
  },
  {
    title: "Bear's Big Feelings",
    emoji: "🐻",
    pages: [
      "Bear felt a big, stormy feeling in his tummy.",
      "He stomped his feet. Stomp! Stomp!",
      "Then Owl said, 'Let's smell the flower and blow out the candle.'",
      "Bear breathed in like smelling a flower… and blew out like a candle.",
      "The storm got smaller and smaller. Bear felt calm again.",
    ],
  },
  {
    title: "The Kind Little Cloud",
    emoji: "☁️",
    pages: [
      "A little cloud floated over the town.",
      "She saw a flower that looked thirsty.",
      "So she rained a gentle, sprinkly rain.",
      "The flower stretched up and said thank you!",
      "Being kind made the little cloud glow pink and happy.",
    ],
  },
];

const tiles = [
  {
    to: "/games/bubbles",
    emoji: "🫧",
    label: "Bubble breaths",
    color: "from-[oklch(0.9_0.08_220)] to-[oklch(0.85_0.1_260)]",
  },
  {
    to: "/games/colouring",
    emoji: "🎨",
    label: "Colouring",
    color: "from-[oklch(0.92_0.1_60)] to-[oklch(0.86_0.12_20)]",
  },
  {
    to: "/games/memory",
    emoji: "🌼",
    label: "Memory",
    color: "from-[oklch(0.92_0.1_130)] to-[oklch(0.85_0.12_170)]",
  },
  {
    to: "/games/emotions",
    emoji: "😊",
    label: "Feeling faces",
    color: "from-[oklch(0.9_0.08_350)] to-[oklch(0.85_0.1_310)]",
  },
  {
    to: "/games/puzzle",
    emoji: "🧩",
    label: "Puzzle",
    color: "from-[oklch(0.9_0.08_280)] to-[oklch(0.85_0.1_240)]",
  },
  {
    to: "/games/adventure",
    emoji: "🌲",
    label: "Forest walk",
    color: "from-[oklch(0.9_0.08_160)] to-[oklch(0.82_0.1_120)]",
  },
];

function KidHome() {
  const { state, setMood } = useApp();
  const { user } = useSession();
  const [said, setSaid] = useState<string | null>(null);
  const [story, setStory] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [exitOpen, setExitOpen] = useState(false);
  const garden = buildGarden(state);
  const todays = state.moods.find((m) => m.date === today());

  return (
    <AppShell title="Play & calm">
      <h1 className="font-display text-4xl font-black sm:text-5xl">
        Hi {user?.displayName ?? "friend"}! 👋
      </h1>

      <section
        className="mt-6 rounded-[2rem] border-2 border-ink bg-card p-5 sm:p-7"
        aria-labelledby="feel"
      >
        <h2 id="feel" className="font-display text-3xl font-bold">
          How do you feel?
        </h2>
        <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-6">
          {feelings.map((f) => (
            <motion.button
              key={f.label}
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                setMood(f.sky, [f.label.toLowerCase()]);
                setSaid(f.say);
                speak(f.say, true);
              }}
              aria-pressed={todays?.tags.includes(f.label.toLowerCase())}
              className={cn(
                "flex flex-col items-center gap-1 rounded-3xl border-4 p-3 text-lg font-black",
                f.color,
                todays?.tags.includes(f.label.toLowerCase()) ? "border-ink" : "border-transparent",
              )}
            >
              <span className="text-5xl sm:text-6xl" aria-hidden="true">
                {f.emoji}
              </span>
              {f.label}
            </motion.button>
          ))}
        </div>
        <AnimatePresence>
          {said && (
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-5 rounded-3xl bg-primary/60 p-4 text-xl font-bold"
            >
              🌿 {said}
            </motion.p>
          )}
        </AnimatePresence>
      </section>

      <section className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3" aria-label="Games">
        {tiles.map((t, i) => (
          <motion.div
            key={t.to}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Link
              to={t.to}
              className={cn(
                "lift flex aspect-square flex-col items-center justify-center gap-2 rounded-[2rem] border-2 border-ink bg-gradient-to-br text-center text-xl font-black",
                t.color,
              )}
            >
              <span className="float-slow text-6xl sm:text-7xl" aria-hidden="true">
                {t.emoji}
              </span>
              {t.label}
            </Link>
          </motion.div>
        ))}
      </section>

      <section
        className="mt-6 rounded-[2rem] border-2 border-ink bg-lavender/60 p-5 sm:p-7"
        aria-labelledby="stories"
      >
        <h2 id="stories" className="font-display text-3xl font-bold">
          Calm stories 📖
        </h2>
        {story === null ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {stories.map((s, i) => (
              <button
                key={s.title}
                onClick={() => {
                  setStory(i);
                  setPage(0);
                  speak(s.pages[0]!, true);
                  void api("/activity", { body: { kind: "story", ref: s.title } }).catch(() => {});
                }}
                className="lift flex items-center gap-3 rounded-3xl border-2 border-ink bg-card p-4 text-left text-lg font-black"
              >
                <span className="text-5xl" aria-hidden="true">
                  {s.emoji}
                </span>
                {s.title}
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-3xl bg-card p-6 text-center">
            <p className="text-7xl" aria-hidden="true">
              {stories[story]!.emoji}
            </p>
            <AnimatePresence mode="wait">
              <motion.p
                key={page}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="mt-4 font-display text-2xl font-bold"
              >
                {stories[story]!.pages[page]}
              </motion.p>
            </AnimatePresence>
            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={() => setStory(null)}
                className="rounded-full border-2 border-ink px-5 py-3 text-lg font-bold"
              >
                Close
              </button>
              {page + 1 < stories[story]!.pages.length ? (
                <button
                  onClick={() => {
                    setPage(page + 1);
                    speak(stories[story]!.pages[page + 1]!, true);
                  }}
                  className="rounded-full border-2 border-ink bg-coral px-6 py-3 text-lg font-black"
                >
                  Next ➜
                </button>
              ) : (
                <button
                  onClick={() => setStory(null)}
                  className="rounded-full border-2 border-ink bg-primary px-6 py-3 text-lg font-black"
                >
                  The end 🌟
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-[2rem] border-2 border-ink bg-primary/50 p-5 sm:p-7">
        <h2 className="font-display text-3xl font-bold">My garden 🌷</h2>
        <p className="mt-1 text-lg font-semibold">
          {garden.items.length === 0
            ? "Pick a feeling or play a game to plant your first seed!"
            : `${garden.items.length} things are growing!`}
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-4xl" aria-hidden="true">
          {garden.items.slice(0, 40).map((it) => (
            <motion.span
              key={it.n}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: it.n * 0.02 }}
            >
              {it.kind === "leaf"
                ? "🌱"
                : it.kind === "flower"
                  ? "🌸"
                  : it.kind === "fern"
                    ? "🌿"
                    : it.kind === "stone"
                      ? "🪨"
                      : "🐦"}
            </motion.span>
          ))}
        </div>
      </section>

      <div className="mt-10 text-center">
        <button
          onClick={() => setExitOpen(true)}
          className="rounded-full border-2 border-dashed border-border px-5 py-2 text-sm font-bold text-muted-foreground"
        >
          🔒 Grown-ups
        </button>
      </div>
      {exitOpen && <ParentExit onClose={() => setExitOpen(false)} />}
    </AppShell>
  );
}

function ParentExit({ onClose }: { onClose: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const qc = useQueryClient();
  const submit = async (p: string) => {
    try {
      await api("/auth/exit-child-mode", { body: { pin: p } });
      await qc.invalidateQueries();
      window.location.href = "/family";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Try again");
      setPin("");
    }
  };
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Grown-up PIN"
    >
      <div className="w-full max-w-xs rounded-3xl bg-card p-6 text-center">
        <p className="font-display text-xl font-bold">Grown-up PIN</p>
        <div className="mt-3 flex justify-center gap-2" aria-live="polite">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={cn("size-4 rounded-full border-2 border-ink", pin.length > i && "bg-ink")}
            />
          ))}
        </div>
        {error && <p className="mt-2 text-sm font-bold text-destructive">{error}</p>}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "⌫"].map((k, i) =>
            k === "" ? (
              <span key={i} />
            ) : (
              <button
                key={i}
                onClick={() => {
                  if (k === "⌫") return setPin((p) => p.slice(0, -1));
                  const next = (pin + k).slice(0, 4);
                  setPin(next);
                  if (next.length === 4) void submit(next);
                }}
                className="rounded-2xl bg-muted py-3 text-xl font-black"
              >
                {k}
              </button>
            ),
          )}
        </div>
        <button onClick={onClose} className="mt-4 text-sm font-bold underline">
          Cancel
        </button>
      </div>
    </div>
  );
}
