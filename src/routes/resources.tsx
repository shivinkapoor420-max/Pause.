import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, CalmToggle, Chip, ScreeningNote } from "@/components/app-shell";
import { LeafSprig } from "@/components/illustrations";
import { resources } from "@/lib/content";
import { useApp, speak } from "@/lib/app-state";

export const Route = createFileRoute("/resources")({
  head: () => ({
    meta: [
      { title: "Resources — Pause." },
      {
        name: "description",
        content:
          "Short, age-appropriate reading on mental health and autism — masking, meltdowns, burnout, and who to ask next.",
      },
      { property: "og:title", content: "Resources — Pause." },
      {
        property: "og:description",
        content: "Plain-language psychoeducation, written for the age band you're in.",
      },
    ],
  }),
  component: Resources,
});

function Resources() {
  const { state } = useApp();
  const band = state.band ?? "adult";
  const items = resources[band];
  const tags = ["All", ...new Set(items.map((i) => i.tag))];
  const [filter, setFilter] = useState("All");
  const shown = filter === "All" ? items : items.filter((i) => i.tag === filter);

  const tint = ["bg-mustard/60", "bg-lavender", "bg-blush", "bg-primary/60"];

  return (
    <AppShell title="Resources">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-4xl font-black tracking-tight">
          Take care of your mental
        </h2>
        <CalmToggle />
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Short reads, written for where you are right now.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {tags.map((t) => (
          <Chip key={t} active={filter === t} onClick={() => setFilter(t)}>
            {t}
          </Chip>
        ))}
      </div>

      <div className="mt-5 grid gap-3">
        {shown.map((r, i) => (
          <article
            key={r.title}
            className={`rounded-3xl border-2 border-ink p-5 ${tint[i % tint.length]}`}
          >
            <p className="text-xs font-bold uppercase tracking-wide">{r.tag}</p>
            <h3 className="mt-1 font-display text-2xl font-bold">{r.title}</h3>
            <p className="mt-2 text-sm font-semibold">{r.body}</p>
            {state.settings.speech && (
              <button
                onClick={() => speak(`${r.title}. ${r.body}`, true)}
                className="mt-3 rounded-full border-2 border-ink bg-card px-4 py-2 text-xs font-bold"
              >
                Read this aloud
              </button>
            )}
          </article>
        ))}
      </div>

      <div className="card-soft mt-5 p-5">
        <h3 className="font-display text-xl font-bold">If today is heavy</h3>
        <p className="mt-1 text-sm">
          Call or text <strong>988</strong> (US Suicide &amp; Crisis Lifeline), or text{" "}
          <strong>HOME</strong> to <strong>741741</strong>. Both are free, confidential, and open
          every hour.
        </p>
      </div>

      <div className="mt-6 flex items-center justify-between gap-4">
        <ScreeningNote />
        <LeafSprig className="size-10 shrink-0 text-forest" />
      </div>
    </AppShell>
  );
}
