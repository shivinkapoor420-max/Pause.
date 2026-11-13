import { Check, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { PillButton } from "@/components/app-shell";
import { defaultRoutine, today, useApp, type RoutineIcon, type RoutineStep } from "@/lib/app-state";
import { cn } from "@/lib/utils";

/**
 * Simple line-art icons in the app's illustrated style — one per routine step.
 * Deliberately picture-first: this age group is often not reading fluently yet.
 */
const icons: Record<RoutineIcon, { label: string; draw: React.ReactNode }> = {
  wake: {
    label: "Wake up",
    draw: (
      <>
        <circle cx="24" cy="26" r="8" />
        <path d="M24 10v5M38 26h5M10 26h5M34 16l3-3M14 16l-3-3M8 38h32" />
      </>
    ),
  },
  breakfast: {
    label: "Breakfast",
    draw: (
      <>
        <path d="M12 20h24a12 12 0 0 1-12 14 12 12 0 0 1-12-14z" />
        <path d="M20 14c0-3 8-3 8 0" />
      </>
    ),
  },
  teeth: {
    label: "Brush teeth",
    draw: (
      <>
        <path d="M14 34l14-14" />
        <path d="M28 20l6-6 4 4-6 6z" />
        <path d="M12 36h6" />
      </>
    ),
  },
  dress: {
    label: "Get dressed",
    draw: (
      <>
        <path d="M18 12l6 4 6-4 8 6-4 6-2-2v14H16V22l-2 2-4-6z" />
      </>
    ),
  },
  school: {
    label: "School",
    draw: (
      <>
        <path d="M8 22l16-8 16 8-16 8z" />
        <path d="M14 26v8c0 3 20 3 20 0v-8" />
      </>
    ),
  },
  play: {
    label: "Play",
    draw: (
      <>
        <circle cx="24" cy="24" r="12" />
        <path d="M12 24h24M24 12c5 6 5 18 0 24" />
      </>
    ),
  },
  snack: {
    label: "Snack",
    draw: (
      <>
        <circle cx="24" cy="26" r="10" />
        <path d="M24 16c0-4 4-6 6-6" />
      </>
    ),
  },
  dinner: {
    label: "Dinner",
    draw: (
      <>
        <path d="M16 12v24M12 12v8a4 4 0 0 0 8 0v-8" />
        <path d="M32 12v24M32 12c4 0 6 4 6 8s-2 6-6 6" />
      </>
    ),
  },
  bath: {
    label: "Bath",
    draw: (
      <>
        <path d="M8 24h32v6a6 6 0 0 1-6 6H14a6 6 0 0 1-6-6z" />
        <path d="M16 24v-8a4 4 0 0 1 8 0" />
      </>
    ),
  },
  story: {
    label: "Story",
    draw: (
      <>
        <path d="M10 14h12a4 4 0 0 1 4 4v18a4 4 0 0 0-4-4H10z" />
        <path d="M38 14H26a4 4 0 0 0-4 4v18a4 4 0 0 1 4-4h12z" />
      </>
    ),
  },
  bed: {
    label: "Bedtime",
    draw: (
      <>
        <path d="M30 12a12 12 0 1 0 8 20 14 14 0 0 1-8-20z" />
        <path d="M14 14l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" />
      </>
    ),
  },
  quiet: {
    label: "Quiet time",
    draw: (
      <>
        <path d="M14 20h6l8-6v20l-8-6h-6z" />
        <path d="M32 18c3 4 3 8 0 12" />
      </>
    ),
  },
};

function StepIcon({ icon, className }: { icon: RoutineIcon; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn("size-full", className)} aria-hidden="true">
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {icons[icon].draw}
      </g>
    </svg>
  );
}

/** "5 more minutes", as a shrinking shape rather than clock time. */
function Countdown() {
  const [total, setTotal] = useState(5 * 60);
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    if (left === null) return;
    const id = setInterval(() => setLeft((v) => (v === null ? null : Math.max(0, v - 1))), 1000);
    return () => clearInterval(id);
  }, [left === null]);

  const start = (minutes: number) => {
    setTotal(minutes * 60);
    setLeft(minutes * 60);
  };

  const share = left === null ? 1 : left / total;

  return (
    <div className="mt-6 rounded-3xl border-2 border-border bg-muted p-5 text-center">
      <p className="font-display text-xl font-bold">How much longer?</p>
      <div className="mt-4 grid place-items-center">
        <div
          className="grid place-items-center rounded-full border-2 border-ink bg-mustard transition-all duration-1000 ease-linear"
          style={{ width: 60 + share * 120, height: 60 + share * 120 }}
        >
          <span className="font-display text-lg font-black">
            {left === null ? "—" : left === 0 ? "Time!" : Math.ceil(left / 60)}
          </span>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        The circle gets smaller as the time runs out. When it's tiny, it's nearly time to switch.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {[1, 2, 5, 10].map((m) => (
          <PillButton
            key={m}
            variant="outline"
            className="px-4 py-2 text-sm"
            onClick={() => start(m)}
          >
            {m} min
          </PillButton>
        ))}
        {left !== null && (
          <PillButton variant="outline" className="px-4 py-2 text-sm" onClick={() => setLeft(null)}>
            Stop
          </PillButton>
        )}
      </div>
    </div>
  );
}

export function VisualRoutine() {
  const { state, setRoutine, toggleRoutineStep } = useApp();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState("");
  const [icon, setIcon] = useState<RoutineIcon>("play");
  const steps = state.routine.length > 0 ? state.routine : defaultRoutine;
  const done = state.routineDone[today()] ?? [];

  return (
    <div className="py-4">
      <p className="text-sm text-muted-foreground">
        {editing
          ? "Caregiver setup: add, rename or remove steps. Your child only ever sees the pictures."
          : "Tap each picture as it happens. Nothing resets overnight until tomorrow, and nothing is ever marked as missed."}
      </p>

      {!editing && (
        <ol className="mt-5 grid gap-3">
          {steps.map((s, i) => {
            const ticked = done.includes(s.id);
            return (
              <li key={s.id}>
                <button
                  onClick={() => toggleRoutineStep(s.id)}
                  aria-pressed={ticked}
                  className={cn(
                    "flex w-full items-center gap-4 rounded-3xl border-2 p-4 text-left transition-colors",
                    ticked ? "border-ink bg-primary" : "border-border bg-muted",
                  )}
                >
                  <span className="grid size-16 shrink-0 place-items-center rounded-2xl border-2 border-ink bg-card p-2 text-ink">
                    <StepIcon icon={s.icon} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-xl font-bold">{s.label}</span>
                    <span className="block text-xs font-bold text-muted-foreground">
                      Step {i + 1} of {steps.length}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "grid size-10 shrink-0 place-items-center rounded-full border-2",
                      ticked ? "border-ink bg-card" : "border-dashed border-border",
                    )}
                  >
                    {ticked && <Check className="size-6" aria-hidden="true" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {editing && (
        <div className="mt-5 grid gap-3">
          {steps.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3 rounded-2xl border-2 border-border bg-muted p-3"
            >
              <span className="size-10 shrink-0 text-ink">
                <StepIcon icon={s.icon} />
              </span>
              <input
                value={s.label}
                onChange={(e) =>
                  setRoutine(
                    steps.map((x) => (x.id === s.id ? { ...x, label: e.target.value } : x)),
                  )
                }
                className="min-w-0 flex-1 rounded-xl border-2 border-border bg-card px-3 py-2 text-sm font-semibold outline-none focus:border-ink"
              />
              <button
                onClick={() => setRoutine(steps.filter((x) => x.id !== s.id))}
                aria-label={`Remove ${s.label}`}
                className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-border"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </div>
          ))}

          <div className="rounded-2xl border-2 border-border p-4">
            <p className="text-sm font-bold">Add a step</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(Object.keys(icons) as RoutineIcon[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setIcon(key)}
                  aria-pressed={icon === key}
                  aria-label={icons[key].label}
                  className={cn(
                    "grid size-12 place-items-center rounded-2xl border-2 p-1.5 text-ink",
                    icon === key ? "border-ink bg-mustard" : "border-border bg-card",
                  )}
                >
                  <StepIcon icon={key} />
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={icons[icon].label}
                className="min-w-0 flex-1 rounded-2xl border-2 border-border bg-muted px-4 py-3 text-sm font-semibold outline-none focus:border-ink"
              />
              <PillButton
                variant="primary"
                className="px-5"
                onClick={() => {
                  setRoutine([
                    ...steps,
                    {
                      id: crypto.randomUUID(),
                      label: label.trim() || icons[icon].label,
                      icon,
                    },
                  ]);
                  setLabel("");
                }}
              >
                <Plus className="size-4" aria-hidden="true" /> Add
              </PillButton>
            </div>
          </div>

          <PillButton variant="outline" onClick={() => setRoutine(defaultRoutine)}>
            Start from the default day
          </PillButton>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        <PillButton variant="outline" onClick={() => setEditing((v) => !v)}>
          {editing ? "Done editing" : "Caregiver: edit the steps"}
        </PillButton>
      </div>

      {!editing && <Countdown />}
    </div>
  );
}
