import {
  AnimatePresence,
  MotionConfig,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { useApp, type Sky } from "@/lib/app-state";
import { cn } from "@/lib/utils";

/**
 * Animations follow each person's own settings: Calm mode or "No motion"
 * turns every JS animation off, and the OS "reduce motion" setting is respected.
 */
export function MotionPrefs({ children }: { children: ReactNode }) {
  const { state } = useApp();
  const off = state.settings.calmMode || state.settings.motion === "none";
  return <MotionConfig reducedMotion={off ? "always" : "user"}>{children}</MotionConfig>;
}

function useCalm() {
  const { state } = useApp();
  const reduce = useReducedMotion();
  return !!reduce || state.settings.calmMode || state.settings.motion === "none";
}

/** Numbers that count up smoothly when they change. */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const calm = useCalm();
  const [shown, setShown] = useState(calm ? value : 0);
  const prev = useRef(0);
  useEffect(() => {
    if (calm) {
      setShown(value);
      return;
    }
    const controls = animate(prev.current, value, {
      duration: 1.1,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => setShown(Math.round(v)),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, calm]);
  return <span className={className}>{shown.toLocaleString()}</span>;
}

/** A card that tilts gently towards the pointer. */
export function TiltCard({ children, className }: { children: ReactNode; className?: string }) {
  const calm = useCalm();
  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);
  const rx = useSpring(useTransform(y, [0, 1], [7, -7]), { stiffness: 200, damping: 18 });
  const ry = useSpring(useTransform(x, [0, 1], [-7, 7]), { stiffness: 200, damping: 18 });
  const glowX = useTransform(x, (v) => `${v * 100}%`);
  const glowY = useTransform(y, (v) => `${v * 100}%`);
  const glow = useTransform(
    [glowX, glowY],
    ([gx, gy]) =>
      `radial-gradient(240px circle at ${gx} ${gy}, oklch(1 0 0 / 35%), transparent 60%)`,
  );
  return (
    <motion.div
      className={cn("group relative [transform-style:preserve-3d]", className)}
      style={calm ? undefined : { rotateX: rx, rotateY: ry, transformPerspective: 800 }}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        x.set((e.clientX - r.left) / r.width);
        y.set((e.clientY - r.top) / r.height);
      }}
      onPointerLeave={() => {
        x.set(0.5);
        y.set(0.5);
      }}
    >
      {children}
      {!calm && (
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[2rem] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: glow }}
        />
      )}
    </motion.div>
  );
}

/** Soft drifting fireflies behind a section. Purely decorative. */
export function Fireflies({ count = 18, className }: { count?: number; className?: string }) {
  const calm = useCalm();
  const [dots] = useState(() =>
    Array.from({ length: count }, (_, i) => ({
      i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      s: 3 + Math.random() * 5,
      d: 6 + Math.random() * 8,
      dx: (Math.random() - 0.5) * 60,
      dy: -20 - Math.random() * 40,
    })),
  );
  if (calm) return null;
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
    >
      {dots.map((d) => (
        <motion.span
          key={d.i}
          className="absolute rounded-full bg-mustard shadow-[0_0_12px_4px_color-mix(in_oklch,var(--color-mustard)_60%,transparent)]"
          style={{ left: `${d.x}%`, top: `${d.y}%`, width: d.s, height: d.s }}
          animate={{ x: [0, d.dx, 0], y: [0, d.dy, 0], opacity: [0, 0.9, 0] }}
          transition={{ duration: d.d, repeat: Infinity, ease: "easeInOut", delay: d.i * 0.4 }}
        />
      ))}
    </div>
  );
}

const burstEmoji: Record<Sky, string[]> = {
  sunny: ["☀️", "✨", "🌼"],
  partly: ["⛅", "🌿", "✨"],
  cloudy: ["☁️", "🍃", "💭"],
  rainy: ["💧", "🌧️", "💙"],
  stormy: ["⚡", "🌧️", "💜"],
};

/** A small, gentle burst when someone picks their mood — every weather gets one, no judgement. */
export function MoodBurst({ sky, burstKey }: { sky: Sky | null; burstKey: number }) {
  const calm = useCalm();
  if (!sky || calm) return null;
  const items = Array.from({ length: 10 }, (_, i) => ({
    i,
    e: burstEmoji[sky][i % 3]!,
    a: (i / 10) * Math.PI * 2,
    r: 60 + (i % 3) * 25,
  }));
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10 grid place-items-center"
    >
      <AnimatePresence>
        {items.map((it) => (
          <motion.span
            key={`${burstKey}-${it.i}`}
            className="absolute text-2xl"
            initial={{ x: 0, y: 0, opacity: 1, scale: 0.4 }}
            animate={{
              x: Math.cos(it.a) * it.r,
              y: Math.sin(it.a) * it.r - 30,
              opacity: 0,
              scale: 1.2,
              rotate: (it.i % 2 ? 1 : -1) * 40,
            }}
            transition={{ duration: 1.1, ease: "easeOut" }}
          >
            {it.e}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}

/** Tap-to-breathe orb: one guided breath (in 4 · hold 2 · out 6). Logged as a calm moment, not a game. */
export function BreathOrb() {
  const calm = useCalm();
  const [phase, setPhase] = useState<"idle" | "in" | "hold" | "out" | "done">("idle");
  const [round, setRound] = useState(0);
  const total = 3;
  useEffect(() => {
    if (phase === "idle" || phase === "done") return;
    const ms = phase === "in" ? 4000 : phase === "hold" ? 2000 : 6000;
    const t = setTimeout(() => {
      if (phase === "in") setPhase("hold");
      else if (phase === "hold") setPhase("out");
      else if (round + 1 >= total) {
        setPhase("done");
        void api("/activity", { body: { kind: "breathing", ref: "home-orb" } }).catch(() => {});
      } else {
        setRound((r) => r + 1);
        setPhase("in");
      }
    }, ms);
    return () => clearTimeout(t);
  }, [phase, round]);
  const label = {
    idle: "Tap to take three slow breaths",
    in: "Breathe in…",
    hold: "Hold softly…",
    out: "And let it go…",
    done: "Lovely. That counted. 🌿",
  }[phase];
  const scale = phase === "in" || phase === "hold" ? 1.35 : 0.85;
  return (
    <section
      className="card-soft relative mt-4 flex flex-col items-center overflow-hidden p-6 text-center"
      aria-live="polite"
    >
      <button
        onClick={() => {
          if (phase === "idle" || phase === "done") {
            setRound(0);
            setPhase("in");
          }
        }}
        className="relative my-10 grid size-40 place-items-center rounded-full"
        aria-label={phase === "idle" || phase === "done" ? "Start three guided breaths" : label}
      >
        <motion.span
          className="absolute inset-0 rounded-full bg-gradient-to-br from-primary via-lavender to-blush"
          animate={
            calm
              ? { opacity: phase === "in" || phase === "hold" ? 1 : 0.6 }
              : { scale: phase === "idle" || phase === "done" ? [0.92, 1, 0.92] : scale }
          }
          transition={
            phase === "idle" || phase === "done"
              ? { duration: 5, repeat: Infinity, ease: "easeInOut" }
              : { duration: phase === "in" ? 4 : phase === "out" ? 6 : 0.5, ease: "easeInOut" }
          }
        />
        <motion.span
          className="absolute inset-0 rounded-full border-4 border-card/70"
          animate={
            calm
              ? {}
              : {
                  scale: phase === "in" || phase === "hold" ? 1.55 : 1,
                  opacity: phase === "idle" ? 0 : 0.5,
                }
          }
          transition={{ duration: phase === "in" ? 4 : 6, ease: "easeInOut" }}
        />
        <span className="relative font-display text-lg font-bold">
          {phase === "idle" ? "🫧" : phase === "done" ? "🌿" : `${round + 1}/${total}`}
        </span>
      </button>
      <p className="font-display text-xl font-bold">{label}</p>
    </section>
  );
}

/** Celebration overlay for a newly earned achievement. */
export function AchievementCelebration({
  title,
  body,
  onDone,
}: {
  title: string;
  body: string;
  onDone: () => void;
}) {
  const calm = useCalm();
  useEffect(() => {
    const t = setTimeout(onDone, 4200);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <motion.div
      role="status"
      className="fixed inset-x-0 top-20 z-[60] mx-auto w-[min(92vw,380px)]"
      initial={{ y: -40, opacity: 0, scale: 0.9 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: -30, opacity: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
    >
      <button
        onClick={onDone}
        className="relative w-full overflow-hidden rounded-3xl border-2 border-ink bg-card p-5 text-left shadow-2xl"
      >
        {!calm &&
          Array.from({ length: 14 }, (_, i) => (
            <motion.span
              key={i}
              aria-hidden="true"
              className="absolute size-2 rounded-full"
              style={{
                left: `${(i * 37) % 100}%`,
                top: "50%",
                background: [
                  "var(--color-mustard)",
                  "var(--color-coral)",
                  "var(--color-primary)",
                  "var(--color-lavender)",
                ][i % 4],
              }}
              initial={{ y: 0, opacity: 1 }}
              animate={{
                y: [-10, -70 - (i % 4) * 15, 40],
                x: (i % 2 ? 1 : -1) * (10 + i * 2),
                opacity: [1, 1, 0],
                rotate: 180,
              }}
              transition={{ duration: 1.6, ease: "easeOut", delay: i * 0.03 }}
            />
          ))}
        <p className="text-xs font-black tracking-wide text-forest uppercase">
          Achievement unlocked
        </p>
        <p className="mt-1 font-display text-2xl font-black">
          <motion.span
            className="inline-block"
            animate={calm ? {} : { rotate: [0, -12, 12, -6, 0], scale: [1, 1.3, 1] }}
            transition={{ duration: 0.9 }}
          >
            {title.split(" ")[0]}
          </motion.span>{" "}
          {title.split(" ").slice(1).join(" ")}
        </p>
        {body && <p className="mt-1 text-sm text-muted-foreground">{body}</p>}
      </button>
    </motion.div>
  );
}

/** Listens for live notifications and celebrates newly earned achievements. */
export function AchievementWatcher() {
  const [shown, setShown] = useState<{ title: string; body: string; key: number } | null>(null);
  useEffect(() => {
    const on = () => {
      void api<{ notification: { kind: string; title: string; body: string } | null }>(
        "/notifications/latest",
      )
        .then((r) => {
          if (r.notification?.kind === "achievement")
            setShown({ title: r.notification.title, body: r.notification.body, key: Date.now() });
        })
        .catch(() => {});
    };
    window.addEventListener("pause:notification", on);
    return () => window.removeEventListener("pause:notification", on);
  }, []);
  return (
    <AnimatePresence>
      {shown && (
        <AchievementCelebration
          key={shown.key}
          title={shown.title}
          body={shown.body}
          onDone={() => setShown(null)}
        />
      )}
    </AnimatePresence>
  );
}
