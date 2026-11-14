import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LoadingCards } from "@/components/kit";
import { TodayPanel } from "@/components/today-panel";
import { BreathOrb, MoodBurst } from "@/components/motion-kit";
import { LocationShare } from "@/components/location-share";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { AppShell, CalmToggle, Chip, PillButton, ScreeningNote } from "@/components/app-shell";
import { Companion } from "@/components/companion-character";
import { PipIntro } from "@/components/pip-intro";

import {
  CornerBotanicals,
  StarryBed,
  WeatherIcon,
  skyMeta,
  skyScale,
} from "@/components/illustrations";
import { moodTags } from "@/lib/content";
import { consistencyNote } from "@/lib/insights";
import { useApp, today, type Sky } from "@/lib/app-state";

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [
      { title: "Today — Pause." },
      {
        name: "description",
        content:
          "Your emotional weather for the week, plus the deeper check-in when a pattern needs more detail.",
      },
      { property: "og:title", content: "Today — Pause." },
      {
        property: "og:description",
        content: "A weekly mood calendar in weather icons, and gentle next steps.",
      },
    ],
  }),
  component: HomeScreen,
});

function lastDays(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1 - i));
    return d;
  });
}

function HomeScreen() {
  const { state, ready, setMood } = useApp();
  const { user } = useSession();
  const [burst, setBurst] = useState<{ sky: Sky | null; key: number }>({ sky: null, key: 0 });
  const navigate = useNavigate();
  const [tags, setTags] = useState<string[]>([]);
  const child = state.band === "child";

  if (!ready || !state.band) {
    return (
      <AppShell title="Today">
        <LoadingCards n={4} />
      </AppShell>
    );
  }

  const todays = state.moods.find((m) => m.date === today());
  const consistency = consistencyNote(state);
  const skies: Sky[] = child ? ["sunny", "cloudy", "rainy"] : skyScale;
  const days = lastDays(7);

  return (
    <AppShell title="Today">
      <PipIntro />
      <CornerBotanicals corner="top-right" className="text-forest" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg font-bold text-forest">Pause.</p>
          <h2 className="font-display text-4xl font-black tracking-tight">
            {greeting()}, {state.name || "there"}!
          </h2>
        </div>
        <CalmToggle />
      </div>

      <TodayPanel />
      {user?.ageGroup === "kids" && (
        <div className="mt-4">
          <LocationShare />
        </div>
      )}
      {user?.ageGroup === "adult" && <AdultHighlights />}

      <Link to="/companion" className="mt-6 block" data-tour="pip">
        <section className="card-soft flex items-center gap-4 p-5">
          <Companion className="size-16 shrink-0 text-forest" />
          <div>
            <h3 className="font-display text-xl font-bold">
              {child ? "Talk to Pip" : "Pip is here to listen"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {child
                ? "Say anything out loud — Pip listens and never judges."
                : "An AI companion that stays with what you're feeling. No advice, no diagnosis."}
            </p>
          </div>
        </section>
      </Link>

      <BreathOrb />

      <section id="mood" className="card-soft relative mt-6 scroll-mt-20 p-6" data-tour="mood">
        <MoodBurst sky={burst.sky} burstKey={burst.key} />
        <h3 className="font-display text-2xl font-bold">
          {child ? "How does it feel today?" : "What's your sky today?"}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {child
            ? "Tap the picture together. There are no wrong answers."
            : "One tap. You can add words underneath if you want to."}
        </p>

        <div className={`mt-5 grid gap-3 ${child ? "grid-cols-3" : "grid-cols-5"}`}>
          {skies.map((sky) => {
            const active = todays?.sky === sky;
            return (
              <button
                key={sky}
                onClick={() => {
                  setMood(sky, tags.length ? tags : (todays?.tags ?? []));
                  setBurst((b) => ({ sky, key: b.key + 1 }));
                }}
                aria-pressed={active}
                className={`flex flex-col items-center gap-2 rounded-3xl border-2 p-3 transition-transform hover:-translate-y-1 active:scale-95 ${
                  active ? "border-ink bg-primary" : "border-border bg-muted"
                } ${child ? "py-6" : ""}`}
              >
                <WeatherIcon
                  sky={sky}
                  className={child ? "size-16 text-ink" : "size-10 text-ink"}
                />
                <span className={`text-center font-bold ${child ? "text-base" : "text-xs"}`}>
                  {child ? skyMeta[sky].kidLabel : skyMeta[sky].label}
                </span>
              </button>
            );
          })}
        </div>

        {!child && (
          <>
            <p className="mt-6 text-sm font-bold">Anything you'd add?</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {moodTags[state.band].map((tag) => (
                <Chip
                  key={tag}
                  active={(todays?.tags ?? tags).includes(tag)}
                  onClick={() => {
                    const base = todays?.tags ?? tags;
                    const next = base.includes(tag)
                      ? base.filter((t) => t !== tag)
                      : [...base, tag];
                    setTags(next);
                    if (todays) setMood(todays.sky, next);
                  }}
                >
                  {tag}
                </Chip>
              ))}
            </div>
          </>
        )}
      </section>

      {consistency && (
        <p className="mt-4 rounded-3xl border-2 border-border bg-primary/40 p-5 font-display text-lg font-bold">
          {consistency}
        </p>
      )}

      {!child && (
        <section className="card-soft mt-4 p-6">
          <h3 className="font-display text-xl font-bold">This week</h3>
          <div className="mt-4 grid grid-cols-7 gap-2">
            {days.map((d) => {
              const key = d.toISOString().slice(0, 10);
              const entry = state.moods.find((m) => m.date === key);
              return (
                <div key={key} className="flex flex-col items-center gap-1">
                  <span className="text-[0.65rem] font-bold text-muted-foreground">
                    {d.toLocaleDateString(undefined, { weekday: "narrow" })}
                  </span>
                  <div
                    className={`grid aspect-square w-full place-items-center rounded-2xl border-2 ${
                      entry ? "border-ink bg-lavender" : "border-dashed border-border bg-muted"
                    }`}
                  >
                    {entry ? (
                      <WeatherIcon sky={entry.sky} className="size-7 text-ink" />
                    ) : (
                      <span className="text-xs text-muted-foreground">·</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Link to="/checkin" className="card-soft block p-5 hover:shadow-lift">
          <p className="font-display text-xl font-bold">Deeper check-in</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {child
              ? "A short caregiver checklist about play, speech, sensory and sleep."
              : "A few more questions, when a pattern needs detail."}
          </p>
        </Link>
        <Link
          to="/dashboard"
          className="card-soft block p-5 hover:shadow-lift"
          data-tour="patterns"
        >
          <p className="font-display text-xl font-bold">Your patterns</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Plain-language trends from what you've logged.
          </p>
        </Link>
        <Link to="/tools" className="card-soft block p-5 hover:shadow-lift" data-tour="tools">
          <p className="font-display text-xl font-bold">
            {child ? "Games & today's picture plan" : "Coping tools"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Breathing, grounding, and games with no way to lose.
          </p>
        </Link>
        <Link
          to="/therapist"
          data-tour="therapist"
          className="block rounded-2xl border-2 border-ink bg-coral p-5 text-coral-foreground"
        >
          <p className="font-display text-xl font-bold">Talk to a therapist</p>
          <p className="mt-1 text-sm">
            We'll draft a brief from your own words. You review it before it's sent.
          </p>
        </Link>
      </div>

      <Link
        to="/directory"
        className="card-soft mt-4 flex items-center gap-4 p-5 hover:shadow-lift"
      >
        <StarryBed className="size-20 shrink-0 text-forest" />
        <span>
          <span className="block font-display text-xl font-bold">Therapist directory</span>
          <span className="mt-1 block text-sm text-muted-foreground">
            Real listed therapists, filterable by what you're dealing with, who they see, insurance
            and cost.
          </span>
        </span>
      </Link>

      <div className="mt-6 flex flex-col gap-3">
        <ScreeningNote />
        <PillButton variant="outline" onClick={() => navigate({ to: "/resources" })}>
          Read about mental health &amp; autism
        </PillButton>
      </div>
    </AppShell>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? "Still up" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/** Adults: a gentle peek into the community and recovery tools. */
function AdultHighlights() {
  const feed = useQuery({
    queryKey: ["feed", "trending", "home"],
    queryFn: () => api("/community/feed?tab=trending"),
  });
  const prompt: string | undefined = feed.data?.prompt;
  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <Link
        to="/community"
        className="lift block rounded-3xl border-2 border-ink bg-lavender/70 p-5"
      >
        <p className="text-sm font-black text-forest uppercase">Today's community prompt</p>
        <p className="mt-1 font-display text-xl font-bold">
          {prompt ?? "Share something small that helped this week."}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">You'll post under your anonymous name.</p>
      </Link>
      <Link to="/recovery" className="lift block rounded-3xl border-2 border-ink bg-primary/70 p-5">
        <p className="text-sm font-black text-forest uppercase">Recovery</p>
        <p className="mt-1 font-display text-xl font-bold">Your milestones, kept private</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Track days, note what's helping, share a milestone if you want to.
        </p>
      </Link>
    </div>
  );
}
