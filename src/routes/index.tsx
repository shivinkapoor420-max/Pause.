import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { CornerBotanicals, IdeaScene, LeafSprig } from "@/components/illustrations";
import { PillButton } from "@/components/app-shell";
import { useApp, type AgeBand } from "@/lib/app-state";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pause. — Notice your patterns, gently" },
      {
        name: "description",
        content:
          "Start with your age band. Pause. adapts its questions, tone and tools for young children, teens and adults.",
      },
      { property: "og:title", content: "Pause. — Notice your patterns, gently" },
      {
        property: "og:description",
        content: "Start with your age band. Pause. adapts its questions, tone and tools for young children, teens and adults.",
      },
    ],
  }),
  component: Welcome,
});

const bands: { id: AgeBand; title: string; sub: string; who: string; tint: string }[] = [
  {
    id: "child",
    title: "4 to 10",
    sub: "A caregiver answers, and we keep it short.",
    who: "I'm a parent or caregiver",
    tint: "bg-blush",
  },
  {
    id: "teen",
    title: "11 to 17",
    sub: "Your account, your words. Grown-ups can add notes later.",
    who: "This is me",
    tint: "bg-lavender",
  },
  {
    id: "adult",
    title: "18 and up",
    sub: "Patterns across months, not just today.",
    who: "This is me",
    tint: "bg-primary",
  },
];

function Welcome() {
  const { state, update } = useApp();
  const navigate = useNavigate();
  const [picked, setPicked] = useState<AgeBand | null>(state.band);

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[70vh]">
        <div className="sky-wash drift" />
      </div>

      <CornerBotanicals corner="bottom-left" className="text-forest" />
      <div className="relative mx-auto w-full max-w-2xl px-5 py-12">
        <div className="flex items-start justify-between">
          <p className="text-2xl font-bold tracking-tight">Pause.</p>
          <LeafSprig className="size-12 text-forest" />
        </div>

        <h1 className="mt-10 font-display text-5xl leading-[1.05] font-black tracking-tight sm:text-6xl">
          Feeling mehh,
          <br />
          or something more?
        </h1>
        <p className="mt-4 max-w-md text-lg text-muted-foreground">
          Notice your patterns over time, pick up tools that actually help, and — when you're ready —
          walk into a therapist's room with something better than a blank page.
        </p>

        <IdeaScene className="mt-8 max-w-xs text-ink" />

        <h2 className="mt-10 font-display text-2xl font-bold">Who is this for?</h2>
        <div className="mt-4 grid gap-3">
          {bands.map((b) => (
            <button
              key={b.id}
              onClick={() => setPicked(b.id)}
              aria-pressed={picked === b.id}
              className={`card-soft flex items-center gap-4 p-5 text-left transition-transform ${
                picked === b.id ? "ink-outline scale-[1.01]" : ""
              }`}
            >
              <span
                className={`grid size-14 shrink-0 place-items-center rounded-full border-2 border-ink font-display text-lg font-black ${b.tint}`}
              >
                {b.title.split(" ")[0]}
              </span>
              <span>
                <span className="block font-display text-xl font-bold">Ages {b.title}</span>
                <span className="block text-sm text-muted-foreground">{b.sub}</span>
                <span className="mt-1 block text-xs font-bold text-forest">{b.who}</span>
              </span>
            </button>
          ))}
        </div>

        <PillButton
          variant="coral"
          className="mt-7 w-full"
          disabled={!picked}
          onClick={() => {
            if (!picked) return;
            update({ band: picked });
            navigate({ to: "/consent" });
          }}
        >
          Continue
        </PillButton>

        <p className="mt-6 text-sm text-muted-foreground">
          Pause. is a screening and support tool, not a diagnosis. It will never tell you that you
          have a condition — it helps you notice what's worth talking to a professional about.
        </p>
      </div>
    </div>
  );
}
