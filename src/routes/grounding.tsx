import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell, PillButton } from "@/components/app-shell";
import { Companion } from "@/components/companion-character";
import { useApp } from "@/lib/app-state";

export const Route = createFileRoute("/grounding")({
  head: () => ({
    meta: [
      { title: "The Grounding Room — Pause." },
      {
        name: "description",
        content:
          "A full-screen illustrated place to breathe with — a clearing, a window nook or a night sky, with optional soft ambient sound.",
      },
      { property: "og:title", content: "The Grounding Room — Pause." },
      { property: "og:description", content: "Open it and just breathe for a minute." },
    ],
  }),
  component: GroundingRoom,
});

type ThemeId = "lantern" | "clearing" | "tide" | "nightsky";

const themes: { id: ThemeId; name: string; blurb: string; element: string }[] = [
  {
    id: "lantern",
    name: "Window nook",
    blurb: "A lantern on the sill, warming and softening.",
    element: "lantern",
  },
  {
    id: "clearing",
    name: "Quiet clearing",
    blurb: "A shape blooming open and closing again.",
    element: "bloom",
  },
  {
    id: "tide",
    name: "Slow tide",
    blurb: "Water reaching up the sand and drawing back.",
    element: "tide",
  },
  {
    id: "nightsky",
    name: "Night sky",
    blurb: "A moon breathing behind thin cloud.",
    element: "moon",
  },
];

const IN_MS = 4000;
const HOLD_MS = 1200;
const OUT_MS = 6000;

function useBreathCycle(active: boolean) {
  const [phase, setPhase] = useState<"in" | "hold" | "out">("in");
  const [breaths, setBreaths] = useState(0);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const step = (next: "in" | "hold" | "out") => {
      if (cancelled) return;
      setPhase(next);
      if (next === "in") timer = setTimeout(() => step("hold"), IN_MS);
      else if (next === "hold") timer = setTimeout(() => step("out"), HOLD_MS);
      else
        timer = setTimeout(() => {
          setBreaths((b) => b + 1);
          step("in");
        }, OUT_MS);
    };
    step("in");
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [active]);

  return { phase, breaths };
}

/** A soft two-note ambient pad, generated rather than streamed. Mutable any time. */
function useAmbient(on: boolean, level: "off" | "minimal" | "full") {
  const ref = useRef<{ ctx: AudioContext; gain: GainNode } | null>(null);

  useEffect(() => {
    if (!on || level === "off" || typeof window === "undefined") return;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const gain = ctx.createGain();
    gain.gain.value = level === "full" ? 0.06 : 0.025;
    gain.connect(ctx.destination);
    for (const freq of [110, 164.81, 220]) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = 0.34;
      osc.connect(g).connect(gain);
      osc.start();
    }
    ref.current = { ctx, gain };
    return () => {
      gain.gain.value = 0;
      void ctx.close();
      ref.current = null;
    };
  }, [on, level]);
}

function BreathElement({
  theme,
  phase,
  cue,
}: {
  theme: ThemeId;
  phase: "in" | "hold" | "out";
  cue: "scale" | "color";
}) {
  const open = phase !== "out";
  const duration = phase === "in" ? IN_MS : phase === "out" ? OUT_MS : HOLD_MS;

  const style =
    cue === "scale"
      ? { transform: `scale(${open ? 1 : 0.62})`, transitionDuration: `${duration}ms` }
      : {
          transform: "scale(0.86)",
          opacity: open ? 1 : 0.45,
          filter: `saturate(${open ? 1.25 : 0.5})`,
          transitionDuration: `${duration}ms`,
        };

  return (
    <div
      className="grid place-items-center transition-all ease-in-out"
      style={style}
      aria-hidden="true"
    >
      <svg viewBox="0 0 120 120" className="size-56 sm:size-72">
        {theme === "lantern" && (
          <g>
            <circle
              cx="60"
              cy="64"
              r="30"
              fill="color-mix(in oklch, var(--color-mustard) 75%, transparent)"
            />
            <rect
              x="42"
              y="40"
              width="36"
              height="52"
              rx="14"
              fill="none"
              stroke="var(--color-ink)"
              strokeWidth="2"
            />
            <path d="M52 34 h16 M60 34 V24" stroke="var(--color-ink)" strokeWidth="2" fill="none" />
          </g>
        )}
        {theme === "clearing" && (
          <g>
            {[0, 60, 120, 180, 240, 300].map((a) => (
              <ellipse
                key={a}
                cx="60"
                cy="36"
                rx="12"
                ry="24"
                transform={`rotate(${a} 60 60)`}
                fill="color-mix(in oklch, var(--color-primary) 70%, transparent)"
                stroke="var(--color-ink)"
                strokeWidth="1.4"
              />
            ))}
            <circle
              cx="60"
              cy="60"
              r="9"
              fill="var(--color-mustard)"
              stroke="var(--color-ink)"
              strokeWidth="1.6"
            />
          </g>
        )}
        {theme === "tide" && (
          <g>
            <path
              d="M6 78 q18 -14 34 0 t34 0 t34 0 V112 H6 Z"
              fill="color-mix(in oklch, var(--color-lavender) 80%, transparent)"
              stroke="var(--color-ink)"
              strokeWidth="1.6"
            />
            <path
              d="M10 92 q22 -10 44 0 t52 0"
              fill="none"
              stroke="var(--color-forest)"
              strokeWidth="1.2"
              opacity="0.6"
            />
          </g>
        )}
        {theme === "nightsky" && (
          <g>
            <circle
              cx="60"
              cy="58"
              r="26"
              fill="color-mix(in oklch, var(--color-blush) 70%, transparent)"
              stroke="var(--color-ink)"
              strokeWidth="1.8"
            />
            <path
              d="M22 84 q20 -10 40 0 t38 -2"
              fill="none"
              stroke="var(--color-card)"
              strokeWidth="6"
              opacity="0.7"
            />
            <path
              d="M22 84 q20 -10 40 0 t38 -2"
              fill="none"
              stroke="var(--color-ink)"
              strokeWidth="1.1"
              opacity="0.4"
            />
          </g>
        )}
      </svg>
    </div>
  );
}

function GroundingRoom() {
  const { state, setSettings, logGrounding } = useApp();
  const child = state.band === "child";
  const [theme, setTheme] = useState<ThemeId>("lantern");
  const [active, setActive] = useState(false);
  const [sound, setSound] = useState(false);
  const { phase, breaths } = useBreathCycle(active);
  const calm = state.settings.calmMode;
  const cue: "scale" | "color" =
    calm || state.settings.motion === "none" ? "color" : state.settings.breathCue;

  useAmbient(active && sound, state.settings.sound === "off" ? "minimal" : state.settings.sound);

  const target = child ? 5 : 12;
  const done = breaths >= target;

  useEffect(() => {
    if (!done || !active) return;
    setActive(false);
    logGrounding(theme, breaths);
  }, [done, active, theme, breaths, logGrounding]);

  const label = phase === "in" ? "Breathe in…" : phase === "hold" ? "Hold…" : "And out…";

  return (
    <AppShell title="The Grounding Room" sky={false}>
      <div
        className="relative -mx-5 -mt-7 flex min-h-dvh flex-col items-center justify-center overflow-hidden px-5 pb-32 pt-10"
        style={{
          background: calm
            ? "linear-gradient(180deg, color-mix(in oklch, var(--color-primary) 30%, var(--color-background)), var(--color-background))"
            : theme === "nightsky"
              ? "linear-gradient(180deg, color-mix(in oklch, var(--color-forest) 65%, var(--color-background)), color-mix(in oklch, var(--color-lavender) 45%, var(--color-background)))"
              : theme === "tide"
                ? "linear-gradient(180deg, color-mix(in oklch, var(--color-lavender) 45%, var(--color-background)), color-mix(in oklch, var(--color-primary) 35%, var(--color-background)))"
                : "linear-gradient(180deg, color-mix(in oklch, var(--color-mustard) 32%, var(--color-background)), color-mix(in oklch, var(--color-blush) 30%, var(--color-background)))",
        }}
      >
        <p className="font-display text-lg font-bold text-forest">The Grounding Room</p>
        <h2 className="mt-1 text-center font-display text-3xl font-black tracking-tight">
          {child ? "Breathe with Pip's lantern" : "Stay a minute. Breathe with it."}
        </h2>

        <div className="mt-6 flex items-center gap-4">
          {child && <Companion className="size-20 text-forest" />}
          <BreathElement theme={child ? "lantern" : theme} phase={phase} cue={cue} />
        </div>

        <p aria-live="polite" className="mt-4 font-display text-2xl font-bold">
          {active ? label : done ? "That's a good place to stop." : "Ready when you are."}
        </p>
        {child && active && (
          <p className="mt-2 text-center text-sm font-bold">
            Pip: "In through your nose… and let it all go."
          </p>
        )}
        {!child && (
          <p className="mt-1 text-sm text-muted-foreground">
            {breaths} breath{breaths === 1 ? "" : "s"} so far — no target you have to hit.
          </p>
        )}

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <PillButton variant="primary" onClick={() => setActive((a) => !a)}>
            {active ? "Pause" : breaths > 0 ? "Keep going" : "Begin"}
          </PillButton>
          <PillButton variant="outline" onClick={() => setSound((s) => !s)}>
            {sound ? "Mute sound" : "Soft sound on"}
          </PillButton>
          {!child && (
            <PillButton
              variant="outline"
              onClick={() =>
                setSettings({ breathCue: state.settings.breathCue === "scale" ? "color" : "scale" })
              }
            >
              {cue === "scale" ? "Use a colour pulse instead" : "Use gentle movement instead"}
            </PillButton>
          )}
        </div>

        {!child && (
          <div className="mt-8 w-full max-w-md">
            <p className="text-center text-sm font-bold">Where would you like to be?</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {themes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  aria-pressed={theme === t.id}
                  className={`rounded-3xl border-2 p-4 text-left ${
                    theme === t.id ? "border-ink bg-card" : "border-border bg-card/70"
                  }`}
                >
                  <span className="block font-display text-lg font-bold">{t.name}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{t.blurb}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/tools">
            <PillButton variant="outline">Back to coping tools</PillButton>
          </Link>
          <Link to="/weather">
            <PillButton variant="outline">Your inner weather</PillButton>
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
