import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, CalmToggle, PillButton, ScreeningNote } from "@/components/app-shell";
import { Companion } from "@/components/companion-character";
import { InnerSky } from "@/components/inner-sky";
import { CornerBotanicals } from "@/components/illustrations";
import { narrateForChild, readInnerWeather } from "@/lib/weather";
import { speak, useApp } from "@/lib/app-state";

export const Route = createFileRoute("/weather")({
  head: () => ({
    meta: [
      { title: "Your inner weather — Pause." },
      {
        name: "description",
        content:
          "A slowly generative illustrated sky drawn from your last few days. Texture and feeling, never a score or a label.",
      },
      { property: "og:title", content: "Your inner weather — Pause." },
      {
        property: "og:description",
        content:
          "A living sky for the emotional climate of your week — no numbers, nothing to read as a diagnosis.",
      },
    ],
  }),
  component: WeatherRoom,
});

function WeatherRoom() {
  const { state } = useApp();
  const child = state.band === "child";
  const [seed, setSeed] = useState(0);
  const [narrated, setNarrated] = useState(false);

  // Seeded on the client so the sky differs visit to visit without breaking SSR.
  useEffect(() => setSeed(Date.now()), []);

  const weather = readInnerWeather(state, seed || 1);
  const narration = narrateForChild(weather);

  useEffect(() => {
    if (!child || !narrated) return;
    speak(narration, true);
  }, [child, narrated, narration]);

  return (
    <AppShell title="Your inner weather">
      <CornerBotanicals corner="top-right" className="text-forest" data-decorative="true" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg font-bold text-forest">Inner weather</p>
          <h2 className="font-display text-4xl font-black tracking-tight">
            {child ? "Pip reads the sky" : "The sky you've been under"}
          </h2>
        </div>
        <CalmToggle />
      </div>

      {child ? (
        <section className="card-soft mt-6 flex flex-col items-center gap-5 p-6 text-center">
          <Companion className="size-32 text-forest" />
          <p className="font-display text-2xl font-bold">
            {narrated ? narration : "Want Pip to tell you what today feels like?"}
          </p>
          <PillButton variant="primary" onClick={() => setNarrated(true)}>
            {narrated ? "Say it again" : "Tell me, Pip"}
          </PillButton>
          <p className="text-sm text-muted-foreground">
            Pip says it out loud. There's nothing to read and nothing to answer.
          </p>
        </section>
      ) : (
        <>
          <div className="mt-6">
            <InnerSky weather={weather} />
          </div>
          <p className="mt-5 font-display text-2xl font-bold leading-snug">{weather.line}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Drawn from your check-ins, journal words and talks with Pip over the last few days. It's
            weather, not a measurement — there's nothing here to score and nothing to compare.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <PillButton variant="outline" onClick={() => setSeed(Date.now())}>
              Let the sky move
            </PillButton>
            <Link to="/garden">
              <PillButton variant="outline">See your garden</PillButton>
            </Link>
            <Link to="/grounding">
              <PillButton variant="primary">Breathe for a minute</PillButton>
            </Link>
          </div>
        </>
      )}

      <div className="mt-8 rounded-3xl border-2 border-border bg-muted p-5 text-sm">
        <p className="font-bold">This is not the patterns view.</p>
        <p className="mt-1 text-muted-foreground">
          The sky is feeling and texture only. Anything worth talking through with a professional
          lives in{" "}
          <Link to="/dashboard" className="underline">
            Patterns worth exploring
          </Link>
          , kept deliberately separate.
        </p>
      </div>

      <div className="mt-6">
        <ScreeningNote />
      </div>
    </AppShell>
  );
}
