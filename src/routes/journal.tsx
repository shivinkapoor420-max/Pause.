import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CornerBotanicals } from "@/components/illustrations";
import { AppShell, CalmToggle, Chip, PillButton } from "@/components/app-shell";
import { WeatherIcon, skyMeta, skyScale } from "@/components/illustrations";
import { journalPrompts } from "@/lib/content";
import { useApp, type Sky } from "@/lib/app-state";

export const Route = createFileRoute("/journal")({
  head: () => ({
    meta: [
      { title: "Journal — Pause." },
      {
        name: "description",
        content: "Prompted or freeform entries, mood-tagged and gathered into a weekly digest of week-cards.",
      },
      { property: "og:title", content: "Journal — Pause." },
      { property: "og:description", content: "Write, speak or draw it — whatever fits the day." },
    ],
  }),
  component: Journal,
});

function weekKey(iso: string) {
  const d = new Date(iso);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

function Journal() {
  const { state, addJournal } = useApp();
  const band = state.band ?? "adult";
  const child = band === "child";
  const prompts = journalPrompts[band];
  const [prompt, setPrompt] = useState<string>(prompts[0] ?? "");
  const [body, setBody] = useState("");
  const [sky, setSky] = useState<Sky | undefined>();
  const [kind, setKind] = useState<"text" | "voice" | "drawing">("text");
  const [tab, setTab] = useState<"write" | "week">("write");

  const weeks = new Map<string, typeof state.journal>();
  for (const e of state.journal) {
    const k = weekKey(e.date);
    weeks.set(k, [...(weeks.get(k) ?? []), e]);
  }

  return (
    <AppShell title="Journal">
      <CornerBotanicals corner="bottom-right" className="text-forest" />
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-4xl font-black tracking-tight">
          {child ? "Our story book" : "My journal"}
        </h2>
        <CalmToggle />
      </div>

      <div className="mt-5 flex gap-2">
        <PillButton
          variant={tab === "write" ? "primary" : "outline"}
          className="px-4 py-2 text-sm"
          onClick={() => setTab("write")}
        >
          New entry
        </PillButton>
        <PillButton
          variant={tab === "week" ? "primary" : "outline"}
          className="px-4 py-2 text-sm"
          onClick={() => setTab("week")}
        >
          My week journal
        </PillButton>
      </div>

      {tab === "write" ? (
        <section className="card-soft mt-5 p-6">
          <p className="text-sm font-bold">Pick a prompt, or write whatever you want.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {prompts.map((p) => (
              <Chip key={p} active={prompt === p} onClick={() => setPrompt(p)}>
                {p}
              </Chip>
            ))}
            <Chip active={prompt === "Freeform"} onClick={() => setPrompt("Freeform")}>
              Freeform
            </Chip>
          </div>

          {child && (
            <div className="mt-5 flex flex-wrap gap-2">
              {(["text", "voice", "drawing"] as const).map((k) => (
                <Chip key={k} active={kind === k} onClick={() => setKind(k)}>
                  {k === "text" ? "Type it" : k === "voice" ? "Say it out loud" : "Draw it"}
                </Chip>
              ))}
            </div>
          )}

          {kind === "text" ? (
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={child ? 4 : 7}
              placeholder={child ? "A grown-up can help you write it." : "In your own words."}
              className="mt-5 w-full rounded-2xl border-2 border-border bg-muted p-4 font-semibold outline-none focus:border-ink"
            />
          ) : (
            <div className="mt-5 rounded-2xl border-2 border-dashed border-ink bg-muted p-6 text-center">
              <p className="font-display text-xl font-bold">
                {kind === "voice" ? "Record a voice note" : "Draw today"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {kind === "voice"
                  ? "Hold the button and tell us about your day. A grown-up can help."
                  : "Draw how the day felt. Colours count as words."}
              </p>
              <PillButton
                variant="coral"
                className="mt-4"
                onClick={() =>
                  setBody(kind === "voice" ? "Voice note recorded with caregiver." : "Drawing saved.")
                }
              >
                {kind === "voice" ? "Record" : "Open drawing pad"}
              </PillButton>
              {body && <p className="mt-3 text-sm font-bold">{body}</p>}
            </div>
          )}

          <p className="mt-5 text-sm font-bold">Tag it with today's weather?</p>
          <div className="mt-2 flex gap-2">
            {skyScale.map((s) => (
              <button
                key={s}
                onClick={() => setSky(s)}
                aria-pressed={sky === s}
                aria-label={skyMeta[s].label}
                className={`grid size-12 place-items-center rounded-2xl border-2 ${
                  sky === s ? "border-ink bg-primary" : "border-border bg-muted"
                }`}
              >
                <WeatherIcon sky={s} className="size-6 text-ink" />
              </button>
            ))}
          </div>

          <PillButton
            variant="coral"
            className="mt-6 w-full"
            disabled={!body.trim()}
            onClick={() => {
              addJournal({ kind, prompt, body: body.trim(), sky });
              setBody("");
              setSky(undefined);
              setTab("week");
            }}
          >
            Save entry
          </PillButton>
        </section>
      ) : state.journal.length === 0 ? (
        <div className="card-soft mt-5 p-6">
          <p className="font-display text-2xl font-bold">Nothing here yet.</p>
          <p className="mt-2 text-muted-foreground">Want to write your first entry?</p>
          <PillButton variant="primary" className="mt-4" onClick={() => setTab("write")}>
            Start writing
          </PillButton>
        </div>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {[...weeks.entries()].map(([k, entries]) => (
            <article key={k} className="card-soft p-5">
              <p className="font-display text-lg font-bold">
                Week of{" "}
                {new Date(k).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </p>
              <p className="text-xs font-bold text-muted-foreground">
                {entries.length} entr{entries.length === 1 ? "y" : "ies"}
              </p>
              <ul className="mt-3 space-y-3">
                {entries.map((e) => (
                  <li key={e.id} className="rounded-2xl bg-muted p-3">
                    <div className="flex items-center gap-2">
                      {e.sky && <WeatherIcon sky={e.sky} className="size-5 text-ink" />}
                      <span className="text-xs font-bold text-muted-foreground">
                        {new Date(e.date).toLocaleDateString(undefined, {
                          weekday: "short",
                          day: "numeric",
                        })}{" "}
                        · {e.kind === "text" ? e.prompt : e.kind === "voice" ? "Voice note" : "Drawing"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-semibold">{e.body}</p>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
    </AppShell>
  );
}
