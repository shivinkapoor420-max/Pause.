import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell, CrisisBanner, PillButton } from "@/components/app-shell";
import { CornerBotanicals, HandoffScene, HandsIllustration } from "@/components/illustrations";
import { usePartners, type Therapist } from "@/lib/therapists";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { bandLabel, useApp } from "@/lib/app-state";
import { buildPatterns, changesSince, daysUsing } from "@/lib/insights";

export const Route = createFileRoute("/therapist")({
  head: () => ({
    meta: [
      { title: "Talk to a therapist — Pause." },
      {
        name: "description",
        content:
          "Pause. drafts a self-report brief from your own check-ins and journal. You review and edit it before anything is sent.",
      },
      { property: "og:title", content: "Talk to a therapist — Pause." },
      {
        property: "og:description",
        content: "Arrive with a well-organised starting point instead of a blank page.",
      },
    ],
  }),
  component: Therapist,
});

function Therapist() {
  const { state, update } = useApp();
  const band = state.band ?? "adult";
  const child = band === "child";
  const patterns = buildPatterns(state);
  const [stage, setStage] = useState<"intro" | "review" | "sent">("intro");
  const lastShare = state.sentBriefs[state.sentBriefs.length - 1];
  const [kind, setKind] = useState<"brief" | "update">("brief");
  const [chosen, setChosen] = useState<Therapist | null>(null);
  const partnerQuery = usePartners();
  const eligible = partnerQuery.data ?? [];
  const [sending, setSending] = useState(false);

  const updateDraft = useMemo(() => {
    const since = lastShare?.at ?? state.startedOn ?? new Date().toISOString();
    const changed = changesSince(state, since);
    const lines: string[] = [];
    lines.push(`Update from Pause. — ${new Date().toLocaleDateString()}`);
    lines.push(
      `Covering what's changed since ${new Date(since).toLocaleDateString()}${lastShare ? ` (last shared with ${lastShare.therapistName})` : ""}.`,
    );
    lines.push("");
    lines.push("SINCE THEN");
    lines.push(
      `- ${changed.moods.length} daily check-in(s), ${changed.checkins.length} deeper check-in(s), ${changed.journal.length} journal entr(y/ies).`,
    );
    if (changed.moods.length > 0) {
      const tally = new Map<string, number>();
      for (const m of changed.moods) tally.set(m.sky, (tally.get(m.sky) ?? 0) + 1);
      lines.push(
        `- Days described as: ${[...tally.entries()].map(([sky, n]) => `${sky} ×${n}`).join(", ")}.`,
      );
      const tags = [...new Set(changed.moods.flatMap((m) => m.tags))];
      if (tags.length > 0) lines.push(`- Words chosen: ${tags.join(", ")}.`);
    }
    if (changed.toolTotal > 0) lines.push(`- Coping tools used ${changed.toolTotal} time(s).`);
    lines.push("");
    lines.push("WHERE THE PATTERNS SIT NOW (descriptive)");
    if (patterns.length === 0) lines.push("- Not enough logged yet to describe a pattern.");
    for (const p of patterns) lines.push(`- ${p.label} — ${p.detail}`);
    lines.push("");
    if (changed.journal.length > 0) {
      lines.push("IN THEIR OWN WORDS, SINCE THE LAST UPDATE");
      for (const e of changed.journal.slice(0, 3))
        lines.push(
          `- ${new Date(e.date).toLocaleDateString()} (${e.prompt}): "${e.body.slice(0, 240)}"`,
        );
      lines.push("");
    }
    if (state.riskFlagged) {
      lines.push(
        "NOTE: a direct safety question was answered affirmatively at some point. Crisis resources were shown in-app.",
      );
      lines.push("");
    }
    lines.push(
      "This is a between-sessions update, self-reported and summarised descriptively. No diagnostic conclusion is implied or intended.",
    );
    return lines.join("\n");
  }, [state, patterns, lastShare]);

  const draft = useMemo(() => {
    const excerpts = state.journal.slice(0, 3);
    const lines: string[] = [];
    lines.push(`Self-report brief prepared in Pause. on ${new Date().toLocaleDateString()}`);
    lines.push("");
    lines.push("PROFILE");
    lines.push(`Age band: ${bandLabel[band]}`);
    lines.push(
      child
        ? `Profile maintained by caregiver${state.caregiverName ? ` (${state.caregiverName})` : ""} for ${state.name || "child"}.`
        : `Name used in app: ${state.name || "not given"}.`,
    );
    lines.push(
      `Using Pause. for ${daysUsing(state)} day(s); ${state.moods.length} daily check-in(s), ${state.checkins.length} deeper check-in(s), ${state.journal.length} journal entr(y/ies).`,
    );
    lines.push("");
    if (state.riskFlagged) {
      lines.push("URGENT — FLAGGED BY THE PERSON'S OWN ANSWER");
      lines.push(
        child
          ? "A caregiver reported self-injurious behaviour when overwhelmed. Crisis resources were shown in-app."
          : "A direct question about self-harm or thoughts of not wanting to be here was answered affirmatively. Crisis resources were shown in-app.",
      );
      lines.push("");
    }
    lines.push("SELF-REPORTED PATTERNS (descriptive, from their own check-ins)");
    if (patterns.length === 0) lines.push("- Not enough logged yet to describe a pattern.");
    for (const p of patterns) lines.push(`- ${p.label} — ${p.detail}`);
    lines.push("");
    lines.push("IN THEIR OWN WORDS (recent journal excerpts)");
    if (excerpts.length === 0) lines.push("- No journal entries yet.");
    for (const e of excerpts)
      lines.push(
        `- ${new Date(e.date).toLocaleDateString()} (${e.prompt}): "${e.body.slice(0, 240)}"`,
      );
    lines.push("");
    lines.push(
      "Note for the receiving clinician: Pause. is a screening and support tool. Everything above is self-report, summarised descriptively. No diagnostic conclusion is implied or intended.",
    );
    return lines.join("\n");
  }, [state, patterns, band, child]);

  const [text, setText] = useState<string | null>(null);
  const value = text ?? (kind === "update" ? updateDraft : draft);

  return (
    <AppShell title="Talk to a therapist">
      <CornerBotanicals corner="top-right" className="text-forest" />
      {state.riskFlagged && <CrisisBanner />}

      {stage === "intro" && (
        <section className="card-soft mt-5 p-6">
          <HandsIllustration className="w-full max-w-xs text-ink" />
          <h2 className="mt-4 font-display text-4xl font-black tracking-tight">
            You don't have to explain it all from scratch.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Pause. can gather what{" "}
            {child ? "you've logged about " + (state.name || "your child") : "you've logged"} into a
            short brief — patterns described in plain language, plus a few of{" "}
            {child ? "their" : "your"} own words. Then {child ? "you" : "you"} read it, change
            anything, and decide whether it goes anywhere.
          </p>
          <ul className="mt-4 grid gap-2 text-sm font-semibold">
            <li className="rounded-2xl bg-muted p-3">Nothing is sent without your review.</li>
            <li className="rounded-2xl bg-muted p-3">
              No diagnostic language — the clinician makes that call, not this app.
            </li>
            <li className="rounded-2xl bg-muted p-3">You can edit or delete any line.</li>
          </ul>
          <PillButton
            variant="coral"
            className="mt-6 w-full"
            onClick={() => {
              setKind("brief");
              setText(null);
              setStage("review");
            }}
          >
            Prepare a first-contact brief
          </PillButton>
          <PillButton
            variant="outline"
            className="mt-3 w-full"
            onClick={() => {
              setKind("update");
              setText(null);
              setStage("review");
            }}
          >
            Share an update with someone I already see
          </PillButton>
          <p className="mt-2 text-sm text-muted-foreground">
            Already in therapy? The update version covers only what's changed since{" "}
            {lastShare ? "your last share" : "you started here"} — the same engine, scoped to what's
            new.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Just looking for someone first?{" "}
            <Link to="/directory" className="font-bold underline">
              Browse the therapist directory
            </Link>
            .
          </p>
          <SentBriefs />
        </section>
      )}

      {stage === "review" && (
        <section className="card-soft mt-5 p-6">
          <h2 className="font-display text-3xl font-black">
            {kind === "update" ? "Your update, before it goes" : "Read it before it goes"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This is yours. Edit anything that doesn't sound like {child ? "your child" : "you"}.
          </p>
          <textarea
            value={value}
            onChange={(e) => setText(e.target.value)}
            rows={20}
            className="mt-4 w-full rounded-2xl border-2 border-border bg-muted p-4 font-mono text-xs leading-relaxed outline-none focus:border-ink"
          />
          <div className="mt-6 rounded-3xl border-2 border-border p-5">
            <h3 className="font-display text-xl font-bold">Where should it go?</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Briefs can only be sent to our <strong>partner network</strong> — therapists who
              signed up to Pause. directly and agreed to receive them. Everyone else in the{" "}
              <Link to="/directory" className="font-bold underline">
                general directory
              </Link>{" "}
              is publicly listed but hasn't opted in, so you contact them yourself and can copy this
              brief to bring along.
            </p>
            <div className="mt-4 grid gap-2">
              {eligible.length === 0 && (
                <p className="rounded-2xl bg-muted p-4 text-sm font-semibold">
                  {partnerQuery.isLoading
                    ? "Loading partner therapists…"
                    : "Our verified partner network is just getting started, and nobody who sees your age group has joined yet. Copy the brief below and bring it to any therapist you choose."}
                </p>
              )}
              {eligible.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setChosen(p)}
                  aria-pressed={chosen?.id === p.id}
                  className={`rounded-2xl border-2 p-4 text-left ${
                    chosen?.id === p.id ? "border-ink bg-primary/50" : "border-border bg-muted"
                  }`}
                >
                  <span className="block font-bold">
                    {p.name} · {p.credentials}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {[p.city, p.stateName].filter(Boolean).join(", ")} ·{" "}
                    {p.issues.slice(0, 4).join(", ")}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <PillButton
              variant="coral"
              disabled={!chosen || sending}
              onClick={async () => {
                if (!chosen) return;
                setSending(true);
                try {
                  const r = await api<{ sentAt: string }>("/briefs", {
                    body: { therapistId: chosen.id, kind, body: value },
                  });
                  update({
                    sentBriefs: [
                      ...state.sentBriefs,
                      { at: r.sentAt, therapistId: chosen.id, therapistName: chosen.name, kind },
                    ],
                  });
                  setStage("sent");
                } catch (e) {
                  toast.error(
                    e instanceof Error ? e.message : "Couldn't send — try copying it instead.",
                  );
                } finally {
                  setSending(false);
                }
              }}
            >
              {chosen
                ? `Send to ${chosen.name.split(" ").slice(-1)[0]}`
                : "Pick a partner therapist"}
            </PillButton>
            <PillButton
              variant="outline"
              onClick={() => {
                void navigator.clipboard?.writeText(value);
              }}
            >
              Copy instead
            </PillButton>
            <PillButton variant="outline" onClick={() => setText(null)}>
              Reset to draft
            </PillButton>
          </div>
        </section>
      )}

      {stage === "sent" && (
        <section className="card-soft mt-5 p-6">
          <HandoffScene className="w-full max-w-xs text-ink" />
          <h2 className="mt-4 font-display text-3xl font-black">Sent. That took courage.</h2>
          <p className="mt-2 text-muted-foreground">
            Your brief has been delivered to {chosen?.name ?? "your chosen partner therapist"}'s
            secure Pause inbox, and they've been emailed to let them know. You'll get a notification
            when they confirm they've received it.
          </p>
          <p className="mt-4 rounded-2xl bg-primary/50 p-4 text-sm font-semibold">
            Want other options too?{" "}
            <Link to="/directory" className="underline">
              The full directory
            </Link>{" "}
            has 100 listed therapists you can call yourself.{" "}
            {child
              ? "For autism specifically, a developmental pediatrician or an autism assessment specialist is the right door."
              : "For autism identification as an adult, look for a clinician who assesses adults specifically."}
          </p>
          <PillButton variant="outline" className="mt-5" onClick={() => setStage("review")}>
            ← Back to the brief
          </PillButton>
        </section>
      )}
    </AppShell>
  );
}

function SentBriefs() {
  const q = useQuery({
    queryKey: ["briefs-mine"],
    queryFn: () => api<{ briefs: any[] }>("/briefs/mine"),
  });
  const list = q.data?.briefs ?? [];
  if (list.length === 0) return null;
  return (
    <div className="mt-6">
      <h3 className="font-display text-xl font-bold">Briefs you've sent</h3>
      <ul className="mt-2 space-y-2">
        {list.map((b) => (
          <li key={b.id} className="rounded-2xl bg-muted p-3 text-sm">
            <span className="font-bold">
              {b.kind === "update" ? "Update" : "Brief"} to {b.therapist_name}
            </span>{" "}
            · {new Date(b.created_at).toLocaleDateString()} ·{" "}
            <span className={b.confirmed_at ? "font-bold text-forest" : "text-muted-foreground"}>
              {b.confirmed_at ? "Receipt confirmed ✓" : b.read_at ? "Opened" : "Delivered"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
