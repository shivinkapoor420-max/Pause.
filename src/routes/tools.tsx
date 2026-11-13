import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell, CalmToggle, PillButton } from "@/components/app-shell";
import { LeafSprig } from "@/components/illustrations";
import { VisualRoutine } from "@/components/routine";
import { useApp } from "@/lib/app-state";

export const Route = createFileRoute("/tools")({
  head: () => ({
    meta: [
      { title: "Coping tools — Pause." },
      {
        name: "description",
        content: "Breathing, grounding, thought reframing and sensory games — regulation tools with no scores and no losing.",
      },
      { property: "og:title", content: "Coping tools — Pause." },
      { property: "og:description", content: "Age-appropriate regulation tools you can use in two minutes." },
    ],
  }),
  component: Tools,
});

type ToolId =
  | "breath"
  | "faces"
  | "bubbles"
  | "ground"
  | "reframe"
  | "bodyscan"
  | "thoughtrecord"
  | "breakdown"
  | "focus"
  | "routine";

const catalog: Record<string, { id: ToolId; title: string; blurb: string; tint: string }[]> = {
  child: [
    { id: "breath", title: "Breathing balloon", blurb: "Breathe in as it grows, out as it shrinks.", tint: "bg-primary" },
    { id: "faces", title: "Which face is it?", blurb: "Tap the face that matches the feeling.", tint: "bg-mustard" },
    { id: "bubbles", title: "Bubble pop", blurb: "Pop the bubbles. No score, no end.", tint: "bg-lavender" },
    { id: "routine", title: "Today's picture plan", blurb: "Tap each picture as the day happens.", tint: "bg-blush" },
  ],
  teen: [
    { id: "breath", title: "Breathing balloon", blurb: "Four in, six out. Two minutes.", tint: "bg-primary" },
    { id: "ground", title: "5-4-3-2-1 grounding", blurb: "Pull attention out of the spiral.", tint: "bg-lavender" },
    { id: "reframe", title: "Catch the thought", blurb: "Pick the more balanced version.", tint: "bg-blush" },
    { id: "focus", title: "Focus break", blurb: "A calm timer between check-ins.", tint: "bg-mustard" },
  ],
  adult: [
    { id: "breath", title: "Breathing balloon", blurb: "Paced breathing, four in, six out.", tint: "bg-primary" },
    { id: "ground", title: "5-4-3-2-1 grounding", blurb: "Anchor back into the room.", tint: "bg-lavender" },
    { id: "reframe", title: "Catch the thought", blurb: "Pick the more balanced version.", tint: "bg-blush" },
    { id: "thoughtrecord", title: "Thought record", blurb: "Situation, thought, evidence, rewrite.", tint: "bg-card" },
    { id: "bodyscan", title: "Body scan", blurb: "Guided, head to feet, six minutes.", tint: "bg-primary" },
    { id: "breakdown", title: "Task breakdown", blurb: "Shrink the first step until it's boring.", tint: "bg-mustard" },
    { id: "focus", title: "Focus timer", blurb: "Calm, no ticking, no pressure.", tint: "bg-lavender" },
  ],
};

function Breath({ child }: { child: boolean }) {
  const [phase, setPhase] = useState<"in" | "out">("in");
  useEffect(() => {
    const id = setInterval(() => setPhase((p) => (p === "in" ? "out" : "in")), 4500);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <div
        className="grid place-items-center rounded-full border-2 border-ink bg-primary transition-all duration-[4500ms] ease-in-out"
        style={{ width: phase === "in" ? 220 : 120, height: phase === "in" ? 220 : 120 }}
      >
        <span className="font-display text-xl font-bold">{phase === "in" ? "In…" : "Out…"}</span>
      </div>
      <p className="text-sm text-muted-foreground">
        {child ? "Big breath as it grows. Let it go as it shrinks." : "Follow the balloon. Four counts in, six out."}
      </p>
    </div>
  );
}

function Faces() {
  const feelings = [
    { label: "Happy", face: "◡" },
    { label: "Sad", face: "︵" },
    { label: "Angry", face: "⌄" },
    { label: "Scared", face: "○" },
  ];
  const [target, setTarget] = useState(0);
  const [said, setSaid] = useState("");
  return (
    <div className="py-4">
      <p className="font-display text-2xl font-bold">
        Which face feels <span className="underline">{feelings[target]!.label}</span>?
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {feelings.map((f, i) => (
          <button
            key={f.label}
            onClick={() => {
              setSaid(i === target ? `Yes! That's ${f.label.toLowerCase()}.` : `That one is ${f.label.toLowerCase()}. Try again — both are okay.`);
              if (i === target) setTarget((target + 1) % feelings.length);
            }}
            className="grid aspect-square place-items-center rounded-3xl border-2 border-ink bg-mustard/70"
          >
            <span className="text-5xl" aria-hidden="true">
              {f.face}
            </span>
            <span className="text-sm font-bold">{f.label}</span>
          </button>
        ))}
      </div>
      {said && <p className="mt-4 rounded-2xl bg-primary/60 p-4 font-bold">{said}</p>}
    </div>
  );
}

function Bubbles() {
  const [bubbles, setBubbles] = useState(() =>
    Array.from({ length: 12 }, (_, i) => ({ id: i, popped: false })),
  );
  return (
    <div className="py-4">
      <div className="grid grid-cols-4 gap-3">
        {bubbles.map((b) => (
          <button
            key={b.id}
            onClick={() =>
              setBubbles((all) => all.map((x) => (x.id === b.id ? { ...x, popped: true } : x)))
            }
            className={`aspect-square rounded-full border-2 transition-all ${
              b.popped ? "scale-50 border-dashed border-border bg-transparent" : "border-ink bg-lavender"
            }`}
            aria-label={b.popped ? "Popped bubble" : "Pop bubble"}
          />
        ))}
      </div>
      <PillButton
        variant="outline"
        className="mt-5"
        onClick={() => setBubbles((all) => all.map((x) => ({ ...x, popped: false })))}
      >
        More bubbles
      </PillButton>
    </div>
  );
}

const groundSteps = [
  "Five things you can see. Say them out loud if you can.",
  "Four things you can hear.",
  "Three things you can touch — actually touch them.",
  "Two things you can smell.",
  "One slow breath. You're here.",
];

function Ground() {
  const [i, setI] = useState(0);
  return (
    <div className="py-6 text-center">
      <p className="font-display text-2xl font-bold leading-snug">{groundSteps[i]}</p>
      <PillButton
        variant="primary"
        className="mt-6"
        onClick={() => setI((v) => Math.min(v + 1, groundSteps.length - 1))}
        disabled={i === groundSteps.length - 1}
      >
        {i === groundSteps.length - 1 ? "Done" : "Next"}
      </PillButton>
    </div>
  );
}

const reframes = [
  {
    thought: "I said one weird thing, so everyone thinks I'm a freak.",
    options: ["Everyone thinks I'm a freak.", "One awkward moment doesn't erase the rest of me."],
  },
  {
    thought: "I got overwhelmed at the shop. I can't handle anything.",
    options: ["I can't handle anything.", "That shop was loud and bright. My system hit its limit — that's specific, not total."],
  },
  {
    thought: "I needed a rest day, so I'm lazy.",
    options: ["I'm lazy.", "Recovery is part of the work, not the opposite of it."],
  },
];

function Reframe() {
  const [i, setI] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const item = reframes[i]!;
  return (
    <div className="py-4">
      <p className="rounded-2xl bg-muted p-4 font-display text-xl font-bold">"{item.thought}"</p>
      <p className="mt-4 text-sm font-bold">Which version is more balanced?</p>
      <div className="mt-3 grid gap-3">
        {item.options.map((o, idx) => (
          <button
            key={o}
            onClick={() => setChosen(idx)}
            className={`rounded-2xl border-2 p-4 text-left font-semibold ${
              chosen === idx ? "border-ink bg-blush" : "border-border bg-card"
            }`}
          >
            {o}
          </button>
        ))}
      </div>
      {chosen !== null && (
        <p className="mt-4 text-sm font-semibold text-muted-foreground">
          {chosen === 1
            ? "That's the one — specific, kind, still honest."
            : "That's the harsh version. Notice how total it sounds — 'everyone', 'anything', 'always'. Try the other one."}
        </p>
      )}
      <PillButton
        variant="outline"
        className="mt-5"
        onClick={() => {
          setChosen(null);
          setI((v) => (v + 1) % reframes.length);
        }}
      >
        Another thought
      </PillButton>
    </div>
  );
}

function BodyScan() {
  const parts = ["forehead and jaw", "shoulders", "hands", "chest and breath", "stomach", "legs", "feet"];
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((v) => (v + 1) % parts.length), 45000);
    return () => clearInterval(id);
  }, [parts.length]);
  return (
    <div className="py-6 text-center">
      <p className="text-sm font-bold text-muted-foreground">
        Step {i + 1} of {parts.length}
      </p>
      <p className="mt-3 font-display text-2xl font-bold">
        Bring your attention to your {parts[i]}. Notice, don't fix.
      </p>
      <PillButton variant="outline" className="mt-6" onClick={() => setI((v) => (v + 1) % parts.length)}>
        Move on
      </PillButton>
    </div>
  );
}

function ThoughtRecord() {
  const [f, setF] = useState({ situation: "", thought: "", evidence: "", rewrite: "" });
  const fields: { key: keyof typeof f; label: string }[] = [
    { key: "situation", label: "What happened?" },
    { key: "thought", label: "What did you think in that moment?" },
    { key: "evidence", label: "What actually supports or contradicts that thought?" },
    { key: "rewrite", label: "How would you say it to a friend?" },
  ];
  return (
    <div className="grid gap-4 py-4">
      {fields.map((field) => (
        <label key={field.key} className="block">
          <span className="text-sm font-bold">{field.label}</span>
          <textarea
            value={f[field.key]}
            onChange={(e) => setF({ ...f, [field.key]: e.target.value })}
            rows={2}
            className="mt-2 w-full rounded-2xl border-2 border-border bg-muted p-3 font-semibold outline-none focus:border-ink"
          />
        </label>
      ))}
      <p className="text-sm text-muted-foreground">
        This stays on your device. Copy it into your journal if you want to keep it.
      </p>
    </div>
  );
}

function Breakdown() {
  const [task, setTask] = useState("");
  const [steps, setSteps] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  return (
    <div className="py-4">
      <label className="block">
        <span className="text-sm font-bold">The thing you're avoiding</span>
        <input
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="e.g. Do my taxes"
          className="mt-2 w-full rounded-2xl border-2 border-border bg-muted px-4 py-3 font-semibold outline-none focus:border-ink"
        />
      </label>
      <div className="mt-4 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="First step — make it boringly small"
          className="flex-1 rounded-2xl border-2 border-border bg-muted px-4 py-3 font-semibold outline-none focus:border-ink"
        />
        <PillButton
          variant="primary"
          className="px-5"
          onClick={() => {
            if (!draft.trim()) return;
            setSteps([...steps, draft.trim()]);
            setDraft("");
          }}
        >
          Add
        </PillButton>
      </div>
      <ol className="mt-4 grid gap-2">
        {steps.map((s, i) => (
          <li key={s + i} className="rounded-2xl border-2 border-border bg-card p-3 font-semibold">
            {i + 1}. {s}
          </li>
        ))}
      </ol>
      {steps.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          Nothing here yet — what's the smallest first move?
        </p>
      )}
    </div>
  );
}

function FocusTimer() {
  const [seconds, setSeconds] = useState(300);
  const [running, setRunning] = useState(false);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (running) {
      ref.current = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    }
    return () => {
      if (ref.current) clearInterval(ref.current);
    };
  }, [running]);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return (
    <div className="py-6 text-center">
      <p className="font-display text-6xl font-black tabular-nums">
        {mm}:{ss}
      </p>
      <div className="mt-5 flex justify-center gap-3">
        <PillButton variant="primary" onClick={() => setRunning(!running)}>
          {running ? "Pause" : "Start"}
        </PillButton>
        <PillButton
          variant="outline"
          onClick={() => {
            setRunning(false);
            setSeconds(300);
          }}
        >
          Reset
        </PillButton>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">No alarm, no ticking. It just quietly ends.</p>
    </div>
  );
}

function Tools() {
  const { state, useTool } = useApp();
  const band = state.band ?? "adult";
  const child = band === "child";
  const [open, setOpen] = useState<ToolId | null>(null);
  const items = catalog[band] ?? catalog["adult"]!;

  const render = (id: ToolId) => {
    switch (id) {
      case "breath":
        return <Breath child={child} />;
      case "faces":
        return <Faces />;
      case "bubbles":
        return <Bubbles />;
      case "ground":
        return <Ground />;
      case "reframe":
        return <Reframe />;
      case "bodyscan":
        return <BodyScan />;
      case "thoughtrecord":
        return <ThoughtRecord />;
      case "breakdown":
        return <Breakdown />;
      case "focus":
        return <FocusTimer />;
      case "routine":
        return <VisualRoutine />;
    }
  };

  return (
    <AppShell title="Coping tools">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-4xl font-black tracking-tight">Coping tools</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {child
              ? "Best played next to a grown-up. Nothing here can be lost or failed."
              : "These are regulation tools, not tests. Nothing is scored."}
          </p>
        </div>
        <CalmToggle />
      </div>

      {open ? (
        <section className="card-soft mt-6 p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-2xl font-bold">
              {items.find((i) => i.id === open)?.title}
            </h3>
            <PillButton variant="outline" className="px-4 py-2 text-sm" onClick={() => setOpen(null)}>
              ← Back
            </PillButton>
          </div>
          {render(open)}
        </section>
      ) : (
        <div className={`mt-6 grid gap-3 ${child ? "" : "sm:grid-cols-2"}`}>
          {items.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setOpen(t.id);
                useTool(t.id);
              }}
              className={`rounded-3xl border-2 border-ink p-5 text-left ${t.tint} ${child ? "py-8" : ""}`}
            >
              <p className="font-display text-xl font-bold">{t.title}</p>
              <p className="mt-1 text-sm">{t.blurb}</p>
              {(state.toolUse[t.id] ?? 0) > 0 && (
                <p className="mt-2 text-xs font-bold opacity-70">
                  Used {state.toolUse[t.id]} time{state.toolUse[t.id] === 1 ? "" : "s"}
                </p>
              )}
            </button>
          ))}
        </div>
      )}

      <LeafSprig className="mt-8 size-10 text-forest" />
    </AppShell>
  );
}
