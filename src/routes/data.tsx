import { toast } from "sonner";
import { api } from "@/lib/api";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell, PillButton, ScreeningNote } from "@/components/app-shell";
import { CornerBotanicals } from "@/components/illustrations";
import { bandLabel, useApp } from "@/lib/app-state";
import { buildPatterns, daysUsing } from "@/lib/insights";

export const Route = createFileRoute("/data")({
  head: () => ({
    meta: [
      { title: "Your data — Pause." },
      {
        name: "description",
        content:
          "One place for full control: export everything, delete your data, or delete your account, in plain language.",
      },
      { property: "og:title", content: "Your data — Pause." },
      {
        property: "og:description",
        content: "Export, delete data, delete account — all of it, explained without legal fog.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DataScreen,
});

function download(name: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function DataScreen() {
  const { state, reset, update } = useApp();
  const navigate = useNavigate();
  const band = state.band ?? "adult";
  const patterns = buildPatterns(state);

  const readable = [
    `Pause. — everything stored for ${state.name || "this profile"}`,
    `Exported ${new Date().toLocaleString()}`,
    `Track: ${bandLabel[band]} · ${daysUsing(state)} day(s) of use`,
    "",
    `Daily check-ins (${state.moods.length}):`,
    ...state.moods.map(
      (m) => `  ${m.date} — ${m.sky}${m.tags.length ? ` (${m.tags.join(", ")})` : ""}`,
    ),
    "",
    `Deeper check-ins (${state.checkins.length}):`,
    ...state.checkins.map(
      (c) =>
        `  ${new Date(c.date).toLocaleDateString()} — ${Object.keys(c.answers).length} answered`,
    ),
    "",
    `Journal entries (${state.journal.length}):`,
    ...state.journal.map(
      (j) => `  ${new Date(j.date).toLocaleDateString()} (${j.prompt}): ${j.body}`,
    ),
    "",
    `Conversations with Pip (${state.companion.length} session(s)):`,
    ...state.companion.flatMap((s) => [
      `  ${new Date(s.date).toLocaleDateString()} — ${s.mode}`,
      ...s.turns.map((t) => `    ${t.role}: ${t.text}`),
    ]),
    "",
    "Patterns described from the above:",
    ...patterns.map((p) => `  - ${p.label}: ${p.detail}`),
    "",
    "Self-report only. Pause. is a screening and support tool, not a diagnosis.",
  ].join("\n");

  return (
    <AppShell title="Your data">
      <CornerBotanicals corner="top-right" className="text-forest" />
      <h2 className="font-display text-4xl font-black tracking-tight">Your data, your call</h2>
      <p className="mt-2 text-muted-foreground">
        Everything you've written, tapped or said to Pip lives on this device. Here's all of it, and
        every way to take it with you or make it gone.
      </p>

      <section className="card-soft mt-5 p-6">
        <h3 className="font-display text-2xl font-bold">Export everything</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Two formats: one written for a human to read (bring it to an appointment), one exact copy
          of the raw data.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <PillButton
            variant="primary"
            onClick={() => download("pause-everything.txt", readable, "text/plain")}
          >
            Readable summary (.txt)
          </PillButton>
          <PillButton
            variant="outline"
            onClick={() =>
              download("pause-data.json", JSON.stringify(state, null, 2), "application/json")
            }
          >
            Full data (.json)
          </PillButton>
        </div>
      </section>

      <section className="card-soft mt-4 p-6">
        <h3 className="font-display text-2xl font-bold">Delete some of it</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Narrow deletions, if you'd rather not clear the whole thing.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <PillButton
            variant="outline"
            onClick={() => {
              if (window.confirm("Delete every conversation with Pip, including tone notes?"))
                update({ companion: [] });
            }}
          >
            Delete Pip conversations
          </PillButton>
          <PillButton
            variant="outline"
            onClick={() => {
              if (window.confirm("Delete every journal entry? This can't be undone."))
                update({ journal: [] });
            }}
          >
            Delete journal
          </PillButton>
          <PillButton
            variant="outline"
            onClick={() => {
              if (window.confirm("Delete your directory notes and 'contacted' markers?"))
                update({ therapistNotes: {}, sentBriefs: [] });
            }}
          >
            Delete directory notes
          </PillButton>
        </div>
      </section>

      <section className="card-soft mt-4 p-6">
        <h3 className="font-display text-2xl font-bold">Delete all of it</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          <strong>Delete my data</strong> clears check-ins, journal, conversations and notes but
          keeps your name, track and settings. <strong>Delete my account</strong> removes every last
          thing, including who you are, and puts you back at the very first screen. Neither can be
          undone, and neither leaves a copy behind.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <PillButton
            variant="outline"
            onClick={() => {
              if (
                window.confirm(
                  "Delete all check-ins, journal entries, conversations and notes? Your name and settings stay.",
                )
              )
                void api("/me/wipe", { method: "POST" })
                  .then(() => {
                    toast.success("Your data has been deleted.");
                    window.location.reload();
                  })
                  .catch((e) => toast.error(e.message));
            }}
          >
            Delete my data
          </PillButton>
          <PillButton
            variant="coral"
            onClick={() => {
              navigate({ to: "/settings", hash: "delete" });
            }}
          >
            Delete my account
          </PillButton>
        </div>
      </section>

      <section className="card-soft mt-4 p-6">
        <h3 className="font-display text-2xl font-bold">What we never do</h3>
        <ul className="mt-3 grid gap-2 text-sm font-semibold">
          <li className="rounded-2xl bg-muted p-3">
            No ad tracking and no third-party sales, ever.
          </li>
          <li className="rounded-2xl bg-muted p-3">
            Nothing reaches a therapist unless you read it and tap send.
          </li>
          <li className="rounded-2xl bg-muted p-3">
            Voice recordings and transcripts are never used for advertising or unrelated model
            training.
          </li>
        </ul>
        <Link to="/welcome" className="mt-4 inline-block">
          <PillButton variant="outline">Re-read the consent text</PillButton>
        </Link>
      </section>

      <div className="mt-6">
        <ScreeningNote />
      </div>
    </AppShell>
  );
}
