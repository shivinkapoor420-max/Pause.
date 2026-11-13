import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PillButton } from "@/components/app-shell";
import { Companion } from "@/components/companion-character";
import { useApp, type AgeBand } from "@/lib/app-state";

type Step = {
  /** Selector for the real UI element this coachmark points at. */
  target?: string;
  title: string;
  body: string;
  /** Optional link shown alongside the step. */
  link?: { to: string; label: string };
};

const steps: Record<AgeBand, Step[]> = {
  child: [
    {
      title: "A 60-second caregiver briefing",
      body: "You're set up. Here's what Pause. does for your child — and, just as importantly, what it doesn't.",
    },
    {
      target: "[data-tour='mood']",
      title: "The daily picture-tap lives here",
      body: "Your child taps the weather that matches their day. Three big options, no words needed, no wrong answers.",
    },
    {
      target: "[data-tour='pip']",
      title: "Pip listens out loud",
      body: "Your child talks, Pip replies warmly. Pip never gives advice and never names a condition. Underneath, Pause. notes emotional tone as an observation with a confidence level — compared only to your child's own earlier conversations, never to other children. A different speech style is never read as distress.",
      link: { to: "/companion", label: "See Pip" },
    },
    {
      target: "[data-tour='tools']",
      title: "Games, and a picture plan for the day",
      body: "Alongside the games there's a visual routine you set up once — wake up, breakfast, teeth, school — that your child taps through as the day happens, with a shrinking-shape countdown for transitions.",
      link: { to: "/tools", label: "Set up the routine" },
    },
    {
      target: "[data-tour='patterns']",
      title: "Your caregiver dashboard",
      body: "Patterns Worth Exploring gathers everything into plain-language notes you can hand to a pediatrician or therapist. Profile → Caregiver view has the export.",
      link: { to: "/dashboard", label: "Open patterns" },
    },
    {
      title: "If something is wrong, you'll know immediately",
      body: "Anything suggesting harm or danger surfaces a crisis banner with 988 and Crisis Text Line on-screen right away, and alerts you as the caregiver. It's never buried in a menu.",
      link: { to: "/resources", label: "Crisis resources" },
    },
  ],
  teen: [
    {
      title: "Quick tour — 30 seconds, skip whenever",
      body: "No manual. Just where things are.",
    },
    {
      title: "What stays private — the short version",
      body: "Your journal and your talks with Pip are yours. A caregiver only ever sees trend summaries, and only if you invite one. The single exception: anything suggesting you're in danger alerts a caregiver right away.",
      link: { to: "/profile", label: "Privacy controls" },
    },
    {
      target: "[data-tour='mood']",
      title: "Tap your sky",
      body: "One tap a day. Add words underneath if you feel like it. That's the whole daily thing.",
    },
    {
      target: "[data-tour='pip']",
      title: "Pip's here whenever",
      body: "Type anything. Pip listens and reflects it back — no advice, no diagnosing, no lectures. It's not a replacement for people, and it'll say so.",
      link: { to: "/companion", label: "Talk to Pip" },
    },
    {
      target: "[data-tour='tools']",
      title: "Coping stuff + journal",
      body: "Breathing, grounding, games you can't lose, and a journal that's only yours.",
      link: { to: "/tools", label: "Coping tools" },
    },
    {
      target: "[data-tour='patterns']",
      title: "Patterns Worth Exploring",
      body: "After a few days this shows what's been showing up — described, never scored, never a label.",
      link: { to: "/dashboard", label: "See patterns" },
    },
    {
      target: "[data-tour='therapist']",
      title: "Finding someone, if you want to",
      body: "There's a real therapist directory you can filter, and Pause. can draft a brief from your own words. You read and edit it first — nothing sends without you tapping send.",
      link: { to: "/directory", label: "Browse the directory" },
    },
  ],
  adult: [
    {
      title: "A short walkthrough on the real screens",
      body: "Skippable at any point, and re-runnable later from Profile.",
    },
    {
      title: "Your data first, since it's the part that matters",
      body: "Entries stay on this device. One screen holds everything: export it all, delete your data, or delete the account outright.",
      link: { to: "/data", label: "Your data" },
    },
    {
      target: "[data-tour='mood']",
      title: "Daily check-in",
      body: "One tap for today's sky, optional tags. The deeper check-in adds detail when a pattern needs it.",
    },
    {
      target: "[data-tour='pip']",
      title: "Pip, the listening companion",
      body: "A companion whose scope is deliberately narrow: listening and reflecting. It never advises, scores or diagnoses, and anything it notices only ever appears as a soft, non-diagnostic pattern.",
      link: { to: "/companion", label: "Talk to Pip" },
    },
    {
      target: "[data-tour='tools']",
      title: "Coping toolkit and journal",
      body: "Breathing, grounding and low-stakes games, plus prompted journalling that feeds the pattern view.",
      link: { to: "/tools", label: "Coping tools" },
    },
    {
      target: "[data-tour='patterns']",
      title: "Patterns Worth Exploring",
      body: "Descriptive trends across weeks — sleep, mood and anxiety, everyday functioning, autism-related traits. Language stays descriptive by design; a diagnosis is a clinician's call.",
      link: { to: "/dashboard", label: "See patterns" },
    },
    {
      target: "[data-tour='therapist']",
      title: "Directory and the brief hand-off",
      body: "Browse 100 real listed therapists by issue, age group, insurance and cost, and reach out yourself. A smaller partner network can receive your reviewed brief directly.",
      link: { to: "/directory", label: "Browse the directory" },
    },
    {
      title: "Your data, up front",
      body: "Entries are treated as sensitive health data and stay on this device. No ad tracking, no third-party sales, and full deletion any time.",
      link: { to: "/profile", label: "Privacy & data settings" },
    },
  ],
};

function useSpotlight(selector: string | undefined, index: number) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => {
    if (!selector) {
      setRect(null);
      return;
    }
    const el = document.querySelector(selector);
    if (!el) {
      setRect(null);
      return;
    }
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    const measure = () => setRect(el.getBoundingClientRect());
    const timer = window.setTimeout(measure, 320);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [selector, index]);
  return rect;
}

export function Tutorial() {
  const { state, ready, update } = useApp();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [index, setIndex] = useState(0);

  const band = state.band ?? "adult";
  const list = steps[band];
  const active =
    ready && state.consented && !state.tutorialDone && pathname === "/home" && index < list.length;
  const step = list[Math.min(index, list.length - 1)]!;
  const rect = useSpotlight(active ? step.target : undefined, index);

  if (!active) return null;

  const finish = () => update({ tutorialDone: true });
  const top = rect ? Math.min(rect.bottom + 12, window.innerHeight - 300) : undefined;

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-label="App walkthrough">
      <div className="absolute inset-0 bg-ink/55 backdrop-blur-[1px]" onClick={finish} />

      {rect && (
        <div
          className="pointer-events-none absolute rounded-3xl border-2 border-mustard"
          style={{
            top: rect.top - 8,
            left: rect.left - 8,
            width: rect.width + 16,
            height: rect.height + 16,
            boxShadow: "0 0 0 9999px color-mix(in oklch, var(--color-ink) 55%, transparent)",
          }}
        />
      )}

      <div
        className="absolute inset-x-4 mx-auto max-w-md"
        style={top !== undefined ? { top } : { bottom: "6.5rem" }}
      >
        <div className="card-soft ink-outline p-5">
          <div className="flex items-start gap-3">
            <Companion className="size-12 shrink-0 text-forest" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-forest">
                Step {index + 1} of {list.length}
                {band === "child" ? " · for the caregiver" : ""}
              </p>
              <h2 className="mt-1 font-display text-xl font-bold">{step.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
              {step.link && (
                <Link
                  to={step.link.to}
                  onClick={finish}
                  className="mt-2 inline-block text-sm font-bold text-forest underline"
                >
                  {step.link.label} →
                </Link>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <button onClick={finish} className="text-sm font-bold text-muted-foreground underline">
              Skip the tour
            </button>
            <div className="flex gap-2">
              {index > 0 && (
                <PillButton
                  variant="outline"
                  className="px-4 py-2 text-sm"
                  onClick={() => setIndex((i) => i - 1)}
                >
                  Back
                </PillButton>
              )}
              <PillButton
                variant="coral"
                className="px-5 py-2 text-sm"
                onClick={() => (index === list.length - 1 ? finish() : setIndex((i) => i + 1))}
              >
                {index === list.length - 1 ? "Got it" : "Next"}
              </PillButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
