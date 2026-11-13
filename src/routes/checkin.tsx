import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell, CrisisBanner, PillButton, ScreeningNote } from "@/components/app-shell";
import { checkinQuestions } from "@/lib/content";
import { speak, useApp } from "@/lib/app-state";

export const Route = createFileRoute("/checkin")({
  head: () => ({
    meta: [
      { title: "Deeper check-in — Pause." },
      {
        name: "description",
        content:
          "An adaptive check-in that changes its questions, input and tone for young children, teens and adults.",
      },
      { property: "og:title", content: "Deeper check-in — Pause." },
      { property: "og:description", content: "Descriptive questions about mood, sleep, sensory experience and daily functioning." },
    ],
  }),
  component: Checkin,
});

function Checkin() {
  const { state, addCheckin, update } = useApp();
  const navigate = useNavigate();
  const band = state.band ?? "adult";
  const all = checkinQuestions[band];

  // Progressive disclosure: a handful of questions at a time, a few more each
  // check-in, framed as getting to know you rather than an intake form. The
  // direct safety question is always included, whatever else is showing.
  const questions = useMemo(() => {
    const shown = all.slice(0, Math.max(3, state.questionsUnlocked));
    for (const q of all) if (q.risk && !shown.includes(q)) shown.push(q);
    return shown;
  }, [all, state.questionsUnlocked]);
  const moreToCome = questions.length < all.length;
  const first = state.checkins.length === 0;
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [done, setDone] = useState(false);

  const q = questions[step]!;
  const flagged = questions.some((qq) => qq.risk && (answers[qq.id] ?? 0) >= 1);


  if (done) {
    return (
      <AppShell title="Check-in complete">
        {flagged && <CrisisBanner />}
        <div className="card-soft mt-4 p-6">
          <h2 className="font-display text-3xl font-black">Thank you for that.</h2>
          <p className="mt-2 text-muted-foreground">
            {band === "child"
              ? "Your answers are saved to the pattern view, so you can show a pediatrician what you've been seeing over time."
              : "That's logged. You'll see it show up as a pattern once there's enough to notice."}
          </p>
          {moreToCome && (
            <p className="mt-3 rounded-2xl bg-muted p-4 text-sm font-semibold">
              That's plenty for now. Next time we'll ask a couple more — Pause. gets to know you a
              few questions at a time rather than all at once.
            </p>
          )}
          {flagged && (
            <p className="mt-3 rounded-2xl bg-blush p-4 text-sm font-semibold">
              {band === "child"
                ? "You flagged self-injury when overwhelmed. This is worth raising with your pediatrician or a child psychologist soon — bring the export from the caregiver view."
                : "Something you shared points to risk of self-harm. This is worth talking to someone about today — not eventually. The numbers above connect you to a person, free, any hour."}
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <PillButton variant="primary" onClick={() => navigate({ to: "/dashboard" })}>
              See my patterns
            </PillButton>
            <PillButton variant="coral" onClick={() => navigate({ to: "/therapist" })}>
              Talk to a therapist
            </PillButton>
          </div>
        </div>
        <div className="mt-5">
          <ScreeningNote />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Deeper check-in">
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-forest transition-all"
            style={{ width: `${((step + 1) / questions.length) * 100}%` }}
          />
        </div>
        <span className="text-xs font-bold text-muted-foreground">
          {step + 1}/{questions.length}
        </span>
      </div>

      {first && (
        <p className="mt-4 rounded-2xl bg-muted p-4 text-sm font-semibold">
          Just a few questions to start — this is us getting to know you, not an intake form. Skip
          anything you'd rather not answer.
        </p>
      )}

      <div className="card-soft mt-6 p-6">
        {q.risk && (
          <p className="mb-3 inline-block rounded-full bg-blush px-3 py-1 text-xs font-bold">
            Direct question — you can skip it
          </p>
        )}
        <h2
          className="font-display text-2xl font-bold leading-snug"
          onClick={() => speak(q.text, state.settings.speech)}
        >
          {q.text}
        </h2>
        {band === "child" && (
          <p className="mt-2 text-sm text-muted-foreground">
            Answer as their caregiver, thinking about the last week or two.
          </p>
        )}

        <div className="mt-5 grid gap-3">
          {q.scale.map((option, i) => (
            <button
              key={option}
              onClick={() => {
                const next = { ...answers, [q.id]: i };
                setAnswers(next);
                if (step + 1 < questions.length) {
                  setStep(step + 1);
                } else {
                  const isFlagged = questions.some((qq) => qq.risk && (next[qq.id] ?? 0) >= 1);
                  addCheckin({ band, answers: next, flagged: isFlagged });
                  update({ questionsUnlocked: Math.min(all.length, state.questionsUnlocked + 2) });
                  setDone(true);
                }
              }}
              className={`min-h-11 rounded-2xl border-2 px-5 py-4 text-left text-base font-bold transition-colors ${
                answers[q.id] === i ? "border-ink bg-primary" : "border-border bg-muted hover:border-ink"
              }`}
            >
              {option}
            </button>
          ))}
        </div>

        <div className="mt-5 flex justify-between">
          <PillButton
            variant="outline"
            className="px-4 py-2 text-sm"
            disabled={step === 0}
            onClick={() => setStep(step - 1)}
          >
            Back
          </PillButton>
          <PillButton
            variant="outline"
            className="px-4 py-2 text-sm"
            onClick={() => {
              if (step + 1 < questions.length) setStep(step + 1);
              else {
                addCheckin({ band, answers, flagged });
                update({ questionsUnlocked: Math.min(all.length, state.questionsUnlocked + 2) });
                setDone(true);
              }
            }}
          >
            Skip this one
          </PillButton>
        </div>
      </div>
    </AppShell>
  );
}
