import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CornerBotanicals } from "@/components/illustrations";
import { AppShell, CalmToggle, Chip, PillButton } from "@/components/app-shell";
import { WeatherIcon, skyMeta, skyScale } from "@/components/illustrations";
import { journalPrompts } from "@/lib/content";
import { DrawingPad, VoiceRecorder } from "@/components/journal-tools";
import { api } from "@/lib/api";
import { useApp, type Sky } from "@/lib/app-state";

export const Route = createFileRoute("/journal")({
  head: () => ({
    meta: [
      { title: "Journal — Pause." },
      {
        name: "description",
        content:
          "Prompted or freeform entries, mood-tagged and gathered into a weekly digest of week-cards.",
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
  const { state, addJournal, update } = useApp();
  const [search, setSearch] = useState("");
  const [grat, setGrat] = useState(["", "", ""]);
  const [padKey, setPadKey] = useState(0);
  const older = state.ageGroup === "teen" || state.ageGroup === "adult";
  const suggest = async () => {
    try {
      const r = await api<{ prompt: string }>("/journal/suggest");
      setPrompt(r.prompt);
    } catch {
      /* keep current prompt */
    }
  };
  const remove = (id: string) => {
    if (!confirm("Delete this entry? This can't be undone.")) return;
    void api(`/journal/${id}`, { method: "DELETE" }).catch(() => {});
    update({ journal: state.journal.filter((j) => j.id !== id) });
  };
  const band = state.band ?? "adult";
  const child = band === "child";
  const prompts = journalPrompts[band];
  const [prompt, setPrompt] = useState<string>(prompts[0] ?? "");
  const [body, setBody] = useState("");
  const [sky, setSky] = useState<Sky | undefined>();
  const [kind, setKind] = useState<"text" | "voice" | "drawing" | "gratitude">("text");
  const [tab, setTab] = useState<"write" | "week">("write");

  const weeks = new Map<string, typeof state.journal>();
  const q = search.trim().toLowerCase();
  const visible = q
    ? state.journal.filter(
        (e) =>
          e.kind !== "drawing" &&
          e.kind !== "voice" &&
          `${e.prompt} ${e.body}`.toLowerCase().includes(q),
      )
    : state.journal;
  for (const e of visible) {
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

          {older && (
            <button
              type="button"
              onClick={() => void suggest()}
              className="mt-3 text-sm font-bold text-forest underline"
            >
              ✨ Suggest a prompt for today
            </button>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            {(["text", "gratitude", "voice", "drawing"] as const).map((k) => (
              <Chip
                key={k}
                active={kind === k}
                onClick={() => {
                  setKind(k);
                  setBody("");
                  setGrat(["", "", ""]);
                }}
              >
                {k === "text"
                  ? "Type it"
                  : k === "gratitude"
                    ? "3 good things"
                    : k === "voice"
                      ? "Say it out loud"
                      : "Draw it"}
              </Chip>
            ))}
          </div>

          {kind === "text" ? (
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={child ? 4 : 7}
              maxLength={20000}
              placeholder={child ? "A grown-up can help you write it." : "In your own words."}
              aria-label="Journal entry"
              className="mt-5 w-full rounded-2xl border-2 border-border bg-muted p-4 font-semibold outline-none focus:border-ink"
            />
          ) : kind === "gratitude" ? (
            <div className="mt-5 space-y-2">
              {grat.map((g, i) => (
                <input
                  key={i}
                  value={g}
                  maxLength={300}
                  onChange={(e) => {
                    const next = grat.map((x, j) => (j === i ? e.target.value : x));
                    setGrat(next);
                    setBody(
                      next
                        .filter((x) => x.trim())
                        .map((x) => `• ${x.trim()}`)
                        .join("\n"),
                    );
                  }}
                  placeholder={
                    [
                      "Something small that went okay…",
                      "Someone or something I appreciated…",
                      "A moment I'd like to remember…",
                    ][i]
                  }
                  aria-label={`Good thing ${i + 1}`}
                  className="w-full rounded-2xl border-2 border-border bg-muted px-4 py-3 font-semibold outline-none focus:border-ink"
                />
              ))}
            </div>
          ) : kind === "voice" ? (
            <div className="mt-5">
              <VoiceRecorder key={padKey} onChange={(d) => setBody(d ?? "")} />
            </div>
          ) : (
            <div className="mt-5">
              <DrawingPad key={padKey} onChange={(d) => setBody(d ?? "")} />
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
              addJournal({
                kind,
                prompt: kind === "gratitude" ? "Three good things" : prompt,
                body: body.trim(),
                sky,
              });
              setBody("");
              setGrat(["", "", ""]);
              setPadKey((k) => k + 1);
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
        <>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your journal…"
            aria-label="Search your journal"
            className="mt-5 w-full rounded-full border-2 border-border bg-card px-5 py-3 font-semibold outline-none focus:border-ink"
          />
          {visible.length === 0 && (
            <p className="mt-4 text-center text-sm text-muted-foreground">
              No entries match "{search}".
            </p>
          )}
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
                          ·{" "}
                          {e.kind === "text"
                            ? e.prompt
                            : e.kind === "voice"
                              ? "Voice note"
                              : e.kind === "gratitude"
                                ? "Three good things"
                                : "Drawing"}
                        </span>
                        <button
                          onClick={() => remove(e.id)}
                          className="ml-auto rounded-full p-1 text-muted-foreground hover:text-destructive"
                          aria-label="Delete entry"
                        >
                          ×
                        </button>
                      </div>
                      {e.kind === "drawing" && e.body.startsWith("data:image") ? (
                        <img
                          src={e.body}
                          alt="Journal drawing"
                          className="mt-2 w-full rounded-xl border border-border bg-white"
                          loading="lazy"
                        />
                      ) : e.kind === "voice" && e.body.startsWith("data:audio") ? (
                        <audio controls src={e.body} className="mt-2 w-full" />
                      ) : (
                        <p className="mt-1 text-sm font-semibold whitespace-pre-line">{e.body}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </>
      )}
    </AppShell>
  );
}
