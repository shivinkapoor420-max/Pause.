import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell, CalmToggle, PillButton, ScreeningNote } from "@/components/app-shell";
import { LeafSprig } from "@/components/illustrations";
import { bandLabel, useApp } from "@/lib/app-state";
import { buildPatterns, daysUsing } from "@/lib/insights";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile & settings — Pause." },
      {
        name: "description",
        content:
          "Calm mode, text size, dyslexia-friendly font and text-to-speech, plus the caregiver view and export for child profiles.",
      },
      { property: "og:title", content: "Profile & settings — Pause." },
      {
        property: "og:description",
        content: "Sensory and accessibility preferences, caregiver trends, and full data deletion.",
      },
    ],
  }),
  component: Profile,
});

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-2xl bg-muted p-4">
      <span>
        <span className="block font-bold">{label}</span>
        <span className="block text-sm text-muted-foreground">{hint}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 size-6 shrink-0 accent-forest"
      />
    </label>
  );
}

function Profile() {
  const { state, setSettings, update } = useApp();
  const navigate = useNavigate();
  const band = state.band ?? "adult";
  const child = band === "child";
  const patterns = buildPatterns(state);

  const exportText = [
    `Pause. summary for ${state.name || "child"} — ${new Date().toLocaleDateString()}`,
    `Caregiver: ${state.caregiverName || "not given"}`,
    `${daysUsing(state)} days of tracking, ${state.moods.length} daily check-ins.`,
    "",
    ...patterns.map((p) => `- ${p.label}: ${p.detail}`),
    "",
    "Self-report only. Screening and support tool, not a diagnosis.",
  ].join("\n");

  return (
    <AppShell title="Profile and settings">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-4xl font-black tracking-tight">
            {state.name ? `${state.name}'s Pause.` : "Your Pause."}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{bandLabel[band]}</p>
        </div>
        <CalmToggle />
      </div>

      <section className="card-soft mt-6 p-6">
        <h3 className="font-display text-2xl font-bold">Sensory &amp; accessibility</h3>
        <div className="mt-4 grid gap-3">
          <Toggle
            label="Calm mode"
            hint="Softens every accent toward cream, stops the ambient weather motion, keeps the layout."
            checked={state.settings.calmMode}
            onChange={(v) => setSettings({ calmMode: v })}
          />
          <Toggle
            label="Dyslexia-friendly font"
            hint="Rounder letterforms, wider spacing between words."
            checked={state.settings.dyslexiaFont}
            onChange={(v) => setSettings({ dyslexiaFont: v })}
          />
          <Toggle
            label="Read text aloud"
            hint="Tap a question or article to hear it."
            checked={state.settings.speech}
            onChange={(v) => setSettings({ speech: v })}
          />
          <div className="rounded-2xl bg-muted p-4">
            <p className="font-bold">Text size</p>
            <input
              type="range"
              min={0.9}
              max={1.4}
              step={0.05}
              value={state.settings.textScale}
              onChange={(e) => setSettings({ textScale: Number(e.target.value) })}
              className="mt-3 w-full accent-forest"
              aria-label="Text size"
            />
            <p className="text-sm text-muted-foreground">
              {Math.round(state.settings.textScale * 100)}% of default
            </p>
          </div>
        </div>
      </section>

      {child && (
        <section className="card-soft mt-4 p-6">
          <h3 className="font-display text-2xl font-bold">Caregiver view</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Trends for {state.name || "your child"}, ready to share with a pediatrician or
            therapist.
          </p>
          <div className="mt-4 grid gap-2">
            {patterns.length === 0 ? (
              <p className="rounded-2xl bg-muted p-4 text-sm font-semibold">
                Nothing here yet — a few days of check-ins will fill this in.
              </p>
            ) : (
              patterns.map((p) => (
                <p key={p.label} className="rounded-2xl bg-muted p-4 text-sm font-semibold">
                  <strong>{p.label}</strong> — {p.detail}
                </p>
              ))
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <PillButton
              variant="primary"
              onClick={() => {
                const blob = new Blob([exportText], { type: "text/plain" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "pause-summary.txt";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Export summary
            </PillButton>
            <Link to="/therapist">
              <PillButton variant="coral">Prepare a therapist brief</PillButton>
            </Link>
          </div>
        </section>
      )}

      <section className="card-soft mt-4 p-6">
        <h3 className="font-display text-2xl font-bold">Contact &amp; reminders</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {child ? "Caregiver phone number" : "Your phone number"}: {state.phone || "not given"}
        </p>
        <div className="mt-3">
          <Toggle
            label="SMS check-in reminders"
            hint="Occasional texts nudging you to check in. Off by default, and never used for anything else."
            checked={state.smsReminders}
            onChange={(v) => update({ smsReminders: v })}
          />
        </div>
        <Link to="/directory" className="mt-4 inline-block">
          <PillButton variant="outline">Therapist directory</PillButton>
        </Link>
      </section>

      {band === "teen" && (
        <section className="card-soft mt-4 p-6">
          <h3 className="font-display text-2xl font-bold">Who can see this</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Your journal and your conversations with Pip are private to you, always. The only thing
            a caregiver can ever see is a trend summary — and only if you invite them.
          </p>
          <div className="mt-4 grid gap-3">
            <Toggle
              label="Invite a caregiver"
              hint="Off unless you turn it on. You can turn it back off whenever you want."
              checked={state.teenPrivacy.caregiverInvited}
              onChange={(v) =>
                update({
                  teenPrivacy: {
                    caregiverInvited: v,
                    shareTrends: v ? state.teenPrivacy.shareTrends : false,
                  },
                })
              }
            />
            {state.teenPrivacy.caregiverInvited && (
              <Toggle
                label="Share check-in trend summaries"
                hint="Plain-language trends only — never your entries, never a transcript, never what you said to Pip."
                checked={state.teenPrivacy.shareTrends}
                onChange={(v) => update({ teenPrivacy: { ...state.teenPrivacy, shareTrends: v } })}
              />
            )}
          </div>
          <p className="mt-3 rounded-2xl bg-mustard/40 p-4 text-sm font-semibold">
            The one exception, same as we said at the start: if something suggests you're in danger,
            a caregiver is alerted straight away regardless of these switches.
          </p>
        </section>
      )}

      <section className="card-soft mt-4 p-6">
        <h3 className="font-display text-2xl font-bold">Privacy</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Your entries are treated as sensitive health data and stay on this device. No ad tracking,
          no third-party sales. Nothing reaches a therapist unless you review and send it yourself.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link to="/data">
            <PillButton variant="primary">Export, delete data or account</PillButton>
          </Link>
          <Link to="/modes">
            <PillButton variant="outline">Every mode, explained</PillButton>
          </Link>
          <Link to="/welcome">
            <PillButton variant="outline">Re-read consent</PillButton>
          </Link>
          <PillButton
            variant="outline"
            onClick={() => {
              update({ tutorialDone: false, ...(child ? { pipIntroDone: false } : {}) });
              navigate({ to: "/home" });
            }}
          >
            Replay the walkthrough
          </PillButton>
        </div>
      </section>

      <div className="mt-6 flex items-center justify-between gap-4">
        <ScreeningNote />
        <LeafSprig className="size-10 shrink-0 text-forest" />
      </div>
    </AppShell>
  );
}
