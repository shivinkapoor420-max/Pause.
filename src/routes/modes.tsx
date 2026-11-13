import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PillButton, ScreeningNote } from "@/components/app-shell";
import { Companion } from "@/components/companion-character";
import { CornerBotanicals } from "@/components/illustrations";
import { bandLabel, useApp } from "@/lib/app-state";

export const Route = createFileRoute("/modes")({
  head: () => ({
    meta: [
      { title: "Every mode in Pause. — one map" },
      {
        name: "description",
        content:
          "Age-band tracks, sensory modes, the two versions of Pip, and who sees what — the whole shape of Pause. on one page.",
      },
      { property: "og:title", content: "Every mode in Pause. — one map" },
      {
        property: "og:description",
        content: "Age tracks, calm mode, companion modes and access views, explained in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Modes,
});

function Group({
  title,
  intro,
  items,
}: {
  title: string;
  intro: string;
  items: { name: string; body: string; current?: boolean }[];
}) {
  return (
    <section className="card-soft mt-4 p-6">
      <h3 className="font-display text-2xl font-bold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{intro}</p>
      <div className="mt-4 grid gap-3">
        {items.map((i) => (
          <div
            key={i.name}
            className={`rounded-2xl border-2 p-4 ${
              i.current ? "border-ink bg-primary/40" : "border-border bg-muted"
            }`}
          >
            <p className="font-display text-lg font-bold">
              {i.name}
              {i.current && (
                <span className="ml-2 rounded-full border-2 border-ink bg-mustard px-2 py-0.5 text-[0.7rem] font-bold uppercase tracking-wide">
                  Yours now
                </span>
              )}
            </p>
            <p className="mt-1 text-sm">{i.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Modes() {
  const { state, setSettings } = useApp();
  const band = state.band ?? "adult";

  return (
    <AppShell title="Every mode in Pause.">
      <CornerBotanicals corner="top-right" className="text-forest" />
      <div className="flex items-start gap-4">
        <Companion className="size-16 shrink-0 text-forest" />
        <div>
          <h2 className="font-display text-4xl font-black tracking-tight">The whole map</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Pause. changes shape depending on who's using it. You're currently in{" "}
            <strong>{bandLabel[band]}</strong>, with{" "}
            <strong>{state.settings.calmMode ? "calm mode" : "full mode"}</strong> on.
          </p>
        </div>
      </div>

      <Group
        title="Age-band tracks"
        intro="Set once at onboarding. This shapes almost everything else — the questions, the words, the tools and who's holding the phone."
        items={[
          {
            name: "Young children (4–10), caregiver-led",
            body: "A caregiver operates most of the app. The child interacts directly with Pip's Voice Companion, the unlabelled emotion faces, the coping games and the visual routines.",
            current: band === "child",
          },
          {
            name: "Teens (11–17), teen-led",
            body: "The teen is the primary voice. Journal entries and Pip conversations are private by default; caregiver involvement is invited, never automatic. A crisis-level signal always alerts a caregiver — that one exception is disclosed up front.",
            current: band === "teen",
          },
          {
            name: "Adults (18+), self-led",
            body: "Fully self-directed, with the most trend-oriented view of the pattern dashboard.",
            current: band === "adult",
          },
        ]}
      />

      <Group
        title="Sensory modes"
        intro="A toggle, independent of age band. A preference, not a permission tied to age or diagnosis."
        items={[
          {
            name: "Full mode (default)",
            body: "The complete illustrated language — ambient weather backdrop, idle companion motion, decorative linework.",
            current: !state.settings.calmMode,
          },
          {
            name: "Calm mode",
            body: "Same layout and typography, colour desaturated toward the cream base, every decorative motion switched off.",
            current: state.settings.calmMode,
          },
        ]}
      />

      <div className="mt-3">
        <PillButton
          variant="outline"
          onClick={() => setSettings({ calmMode: !state.settings.calmMode })}
        >
          Switch to {state.settings.calmMode ? "full mode" : "calm mode"}
        </PillButton>
      </div>

      <Group
        title="Companion modes"
        intro="Which version of Pip you're talking to. Both are non-diagnostic by design."
        items={[
          {
            name: "Voice Companion (4–10)",
            body: "Talk out loud, Pip replies warmly. Emotional tone is noted as an observation with a confidence level, visible to the caregiver, compared only to the child's own earlier conversations.",
            current: band === "child",
          },
          {
            name: "Listening Companion (11+)",
            body: "Reflective listening only. No advice, no techniques, no diagnosis — and it says so if you ask for advice.",
            current: band !== "child",
          },
        ]}
      />

      <Group
        title="Access views"
        intro="Who sees what, stated plainly."
        items={[
          {
            name: "Self view",
            body: "What the primary user sees — teen, adult, or a young child through Pip and the faces.",
          },
          {
            name: "Caregiver view",
            body: "For young children's accounts: trend dashboards, consent controls and the export. For teen accounts: trend summaries only, if the teen invited a caregiver, plus the disclosed crisis exception.",
          },
        ]}
      />

      <div className="mt-5 flex flex-wrap gap-3">
        <Link to="/profile">
          <PillButton variant="outline">Profile &amp; settings</PillButton>
        </Link>
        <Link to="/data">
          <PillButton variant="outline">Your data</PillButton>
        </Link>
      </div>

      <div className="mt-6">
        <ScreeningNote />
      </div>
    </AppShell>
  );
}
