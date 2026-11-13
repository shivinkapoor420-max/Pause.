import { Link, createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useState } from "react";
import { Plus, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PillButton } from "@/components/app-shell";
import { Card, EmptyState, Field, PageHeader, inputCls } from "@/components/kit";
import { api } from "@/lib/api";
import { useApp } from "@/lib/app-state";

export const Route = createFileRoute("/recovery")({
  head: () => ({ meta: [{ title: "Recovery — Pause." }] }),
  component: Recovery,
});

type Tracker = {
  id: string;
  label: string;
  since: string;
  why: string;
  notes: { at: string; text: string }[];
};
const milestones = [1, 3, 7, 14, 30, 60, 90, 180, 365, 730];
const presets = [
  "Smoking",
  "Alcohol",
  "Gambling / poker",
  "Gaming",
  "Scrolling",
  "Cannabis",
  "Sugar",
  "Something else",
];

function daysSince(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
}

/** Private recovery trackers, stored in the user's private app data. Sharing a milestone is always opt-in. */
function Recovery() {
  const { state, update } = useApp();
  const trackers = ((state as unknown as { recovery?: Tracker[] }).recovery ?? []) as Tracker[];
  const save = (next: Tracker[]) => {
    update({ ...({ recovery: next } as object) } as never);
    void api("/me", { method: "PATCH", body: { appData: { recovery: next } } }).catch(() =>
      toast.error("Couldn't save"),
    );
  };
  const [adding, setAdding] = useState(trackers.length === 0);
  const [label, setLabel] = useState("");
  const [since, setSince] = useState(new Date().toISOString().slice(0, 10));
  const [why, setWhy] = useState("");

  return (
    <AppShell title="Recovery" wide>
      <PageHeader
        eyebrow="One day at a time"
        title="Recovery"
        subtitle="Private trackers for whatever you're stepping away from. Only you can see these. A slip doesn't erase your progress — you can always start a new count."
        action={
          <PillButton variant="coral" onClick={() => setAdding(true)}>
            <Plus className="size-5" /> New tracker
          </PillButton>
        }
      />
      {adding && (
        <Card className="mb-6">
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              save([
                ...trackers,
                { id: crypto.randomUUID(), label: label.trim(), since, why: why.trim(), notes: [] },
              ]);
              setAdding(false);
              setLabel("");
              setWhy("");
            }}
          >
            <Field label="What are you stepping away from?">
              <input
                required
                list="recovery-presets"
                maxLength={40}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className={inputCls}
              />
              <datalist id="recovery-presets">
                {presets.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </Field>
            <Field label="Since">
              <input
                type="date"
                required
                max={new Date().toISOString().slice(0, 10)}
                value={since}
                onChange={(e) => setSince(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Your why (optional)" hint="A reminder for the hard moments.">
              <input
                maxLength={200}
                value={why}
                onChange={(e) => setWhy(e.target.value)}
                className={inputCls}
                placeholder="For my lungs, my mornings, my kids…"
              />
            </Field>
            <div className="flex items-end gap-2">
              <PillButton type="submit" variant="forest">
                Start tracking
              </PillButton>
              <PillButton type="button" variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </PillButton>
            </div>
          </form>
        </Card>
      )}
      {trackers.length === 0 && !adding ? (
        <EmptyState emoji="🌱" title="No trackers yet" body="Start one whenever you're ready." />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {trackers.map((t) => (
            <TrackerCard
              key={t.id}
              t={t}
              onChange={(nt) => save(trackers.map((x) => (x.id === t.id ? nt : x)))}
              onDelete={() =>
                confirm("Delete this tracker?") && save(trackers.filter((x) => x.id !== t.id))
              }
            />
          ))}
        </div>
      )}
      <Card className="mt-8 grid gap-4 sm:grid-cols-3">
        <Link to="/tools" className="rounded-2xl bg-primary/60 p-4 font-bold">
          🫁 Riding out a craving? Try a 2-minute breathing exercise.
        </Link>
        <Link
          to="/community/c/$slug"
          params={{ slug: "one-day-at-a-time" }}
          className="rounded-2xl bg-lavender/70 p-4 font-bold"
        >
          💬 Cravings & Hard Days — reach out anonymously.
        </Link>
        <Link to="/companion" className="rounded-2xl bg-blush/70 p-4 font-bold">
          🌿 Talk it through with Pip, any time.
        </Link>
      </Card>
    </AppShell>
  );
}

function TrackerCard({
  t,
  onChange,
  onDelete,
}: {
  t: Tracker;
  onChange: (t: Tracker) => void;
  onDelete: () => void;
}) {
  const d = daysSince(t.since);
  const next = milestones.find((m) => m > d) ?? d + 365;
  const prev = [...milestones].reverse().find((m) => m <= d) ?? 0;
  const [note, setNote] = useState("");
  const share = async () => {
    try {
      const r = await api<{ status: string }>("/community/posts", {
        body: {
          body: `${d} days without ${t.label.toLowerCase()} today. One day at a time. 🌱 #milestone`,
          kind: "milestone",
          anonymous: true,
        },
      });
      toast.success(
        r.status === "pending"
          ? "Shared — it'll appear after a quick review"
          : "Milestone shared anonymously 💛",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't share");
    }
  };
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-black text-forest uppercase">{t.label}</p>
          <motion.p
            key={d}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="font-display text-6xl font-black"
          >
            {d}
            <span className="ml-2 text-2xl font-bold text-muted-foreground">
              day{d === 1 ? "" : "s"}
            </span>
          </motion.p>
          {t.why && <p className="mt-1 text-sm italic">"{t.why}"</p>}
        </div>
        <button
          onClick={onDelete}
          className="rounded-full p-2 text-muted-foreground hover:bg-muted"
          aria-label="Delete tracker"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <div className="mt-4">
        <div className="flex justify-between text-xs font-bold text-muted-foreground">
          <span>{prev} days</span>
          <span>Next: {next} days</span>
        </div>
        <div className="mt-1 h-3 overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full bg-forest"
            initial={{ width: 0 }}
            animate={{ width: `${((d - prev) / (next - prev)) * 100}%` }}
            transition={{ duration: 1 }}
          />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {milestones
          .filter((m) => m <= d)
          .map((m) => (
            <span key={m} className="rounded-full bg-mustard px-3 py-1 text-xs font-black">
              🏅 {m}d
            </span>
          ))}
      </div>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!note.trim()) return;
          onChange({
            ...t,
            notes: [{ at: new Date().toISOString(), text: note.trim() }, ...t.notes].slice(0, 50),
          });
          setNote("");
        }}
      >
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          placeholder="What helped today?"
          className={`${inputCls} py-2`}
        />
        <PillButton type="submit" variant="outline" className="shrink-0 px-4">
          Add
        </PillButton>
      </form>
      {t.notes.length > 0 && (
        <ul className="mt-3 max-h-32 space-y-1 overflow-y-auto text-sm">
          {t.notes.map((n) => (
            <li key={n.at} className="rounded-xl bg-muted px-3 py-1.5">
              <span className="text-xs text-muted-foreground">
                {new Date(n.at).toLocaleDateString()} ·{" "}
              </span>
              {n.text}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <PillButton variant="outline" onClick={() => void share()}>
          <Share2 className="size-4" /> Share milestone anonymously
        </PillButton>
        <PillButton
          variant="ghost"
          onClick={() => {
            if (
              confirm(
                "Start a fresh count from today? Your notes and past milestones stay. A reset isn't failure — it's coming back.",
              )
            )
              onChange({ ...t, since: new Date().toISOString().slice(0, 10) });
          }}
        >
          Start a fresh count
        </PillButton>
      </div>
    </Card>
  );
}
