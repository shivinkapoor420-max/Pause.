import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, CalmToggle, PillButton, ScreeningNote } from "@/components/app-shell";
import { CornerBotanicals, WeatherSceneIllustration, WeatherIcon, skyMeta } from "@/components/illustrations";
import { buildPatterns, daysUsing } from "@/lib/insights";
import { useApp } from "@/lib/app-state";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Your patterns — Pause." },
      {
        name: "description",
        content: "Plain-language trends from your own check-ins — no scores, no labels, no diagnoses.",
      },
      { property: "og:title", content: "Your patterns — Pause." },
      { property: "og:description", content: "What's been showing up lately, described rather than scored." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { state } = useApp();
  const patterns = buildPatterns(state);
  const child = state.band === "child";
  const recent = state.moods.slice(-14).reverse();

  return (
    <AppShell title="Your patterns">
      <CornerBotanicals corner="bottom-left" className="text-forest" />
      <WeatherSceneIllustration className="w-full max-w-sm text-ink" />
      <div className="mt-3 flex items-start justify-between gap-3">
        <h2 className="font-display text-4xl font-black tracking-tight">
          {child ? `What we're noticing about ${state.name || "your child"}` : "What we're noticing"}
        </h2>
        <CalmToggle />
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {daysUsing(state)} day{daysUsing(state) === 1 ? "" : "s"} of check-ins · described in plain
        language, never scored
      </p>

      {patterns.length === 0 ? (
        <div className="card-soft mt-6 p-6">
          <p className="font-display text-2xl font-bold">Nothing to show yet.</p>
          <p className="mt-2 text-muted-foreground">
            Patterns need a few days to appear. Want to log today's weather?
          </p>
          <Link to="/home" className="mt-4 inline-block">
            <PillButton variant="primary">Check in today</PillButton>
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-3">
          {patterns.map((p) => (
            <div
              key={p.label}
              className={`rounded-3xl border-2 p-5 ${
                p.urgent ? "border-ink bg-coral/70 text-coral-foreground" : "border-border bg-card"
              }`}
            >
              <p className="font-display text-xl font-bold">{p.label}</p>
              <p className="mt-1 text-sm">{p.detail}</p>
            </div>
          ))}
        </div>
      )}

      {recent.length > 0 && (
        <section className="card-soft mt-4 p-6">
          <h3 className="font-display text-xl font-bold">Recent days</h3>
          <ul className="mt-4 space-y-3">
            {recent.map((m) => (
              <li key={m.date} className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-2xl border-2 border-border bg-muted">
                  <WeatherIcon sky={m.sky} className="size-6 text-ink" />
                </span>
                <span>
                  <span className="block text-sm font-bold">
                    {new Date(m.date).toLocaleDateString(undefined, {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {child ? skyMeta[m.sky].kidLabel : skyMeta[m.sky].label}
                    {m.tags.length ? ` · ${m.tags.join(", ")}` : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <Link to="/directory">
          <PillButton variant="primary">Find a therapist</PillButton>
        </Link>
        <Link to="/therapist">
          <PillButton variant="coral">Talk to a therapist</PillButton>
        </Link>
        <Link to="/checkin">
          <PillButton variant="outline">Deeper check-in</PillButton>
        </Link>
        {child && (
          <Link to="/profile">
            <PillButton variant="outline">Caregiver view &amp; export</PillButton>
          </Link>
        )}
      </div>

      <div className="mt-6">
        <ScreeningNote />
      </div>
    </AppShell>
  );
}
