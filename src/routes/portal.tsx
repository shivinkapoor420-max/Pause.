import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PillButton, ScreeningNote } from "@/components/app-shell";
import { HandoffScene } from "@/components/illustrations";
import { useApp, type PortalTherapist } from "@/lib/app-state";

export const Route = createFileRoute("/portal")({
  head: () => ({
    meta: [
      { title: "Therapist portal — Pause." },
      {
        name: "description",
        content:
          "For partner-network clinicians: verify your licence, receive client-authored self-report briefs, and confirm receipt so the client knows it landed.",
      },
      { property: "og:title", content: "Therapist portal — Pause." },
      {
        property: "og:description",
        content:
          "Receive self-report briefs written and reviewed by the client, and confirm they arrived.",
      },
    ],
  }),
  component: Portal,
});

const empty = {
  name: "",
  email: "",
  license: "",
  licenseState: "",
  practice: "",
  acceptsBriefs: true,
};

function Signup({ onDone }: { onDone: (t: PortalTherapist) => void }) {
  const [form, setForm] = useState(empty);
  const valid =
    form.name.trim().length > 1 &&
    /.+@.+\..+/.test(form.email) &&
    form.license.trim().length >= 4 &&
    form.licenseState.trim().length === 2;

  const field = (
    key: keyof typeof empty,
    label: string,
    hint: string,
    props: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <label className="block">
      <span className="block font-bold">{label}</span>
      <span className="block text-sm text-muted-foreground">{hint}</span>
      <input
        {...props}
        value={form[key] as string}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="mt-2 w-full rounded-2xl border-2 border-border bg-card px-4 py-3 text-base"
      />
    </label>
  );

  return (
    <section className="card-soft mt-6 p-6">
      <h3 className="font-display text-2xl font-bold">Join the partner network</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Partner clinicians can receive briefs directly. Every brief is written from a person's own
        words and sent only after they read it and press send.
      </p>
      <div className="mt-5 grid gap-4">
        {field("name", "Full name", "As it appears on your licence.", { autoComplete: "name" })}
        {field("email", "Work email", "Where new brief notifications go.", {
          type: "email",
          autoComplete: "email",
        })}
        {field(
          "license",
          "Licence number",
          "Checked against your state board before you're listed.",
        )}
        {field("licenseState", "Licence state", "Two-letter state code, e.g. CA.", {
          maxLength: 2,
        })}
        {field("practice", "Practice or clinic", "Optional — shown on your directory card.")}
        <label className="flex items-start justify-between gap-4 rounded-2xl bg-muted p-4">
          <span>
            <span className="block font-bold">Accept automated briefs</span>
            <span className="block text-sm text-muted-foreground">
              You can turn this off any time and stay listed in the general directory.
            </span>
          </span>
          <input
            type="checkbox"
            checked={form.acceptsBriefs}
            onChange={(e) => setForm({ ...form, acceptsBriefs: e.target.checked })}
            className="mt-1 size-6 shrink-0 accent-forest"
          />
        </label>
      </div>
      <PillButton
        variant="primary"
        className="mt-5"
        disabled={!valid}
        onClick={() => onDone({ ...form, verifiedAt: new Date().toISOString() })}
      >
        Submit for verification
      </PillButton>
      <p className="mt-3 text-sm text-muted-foreground">
        Verification is manual and usually takes two business days. Nothing is shared with clients
        until it completes.
      </p>
    </section>
  );
}

function Portal() {
  const { state, update, confirmBriefReceipt } = useApp();
  const portal = state.portal;

  if (!portal) {
    return (
      <AppShell title="Therapist portal">
        <p className="font-display text-lg font-bold text-forest">For clinicians</p>
        <h2 className="font-display text-4xl font-black tracking-tight">Therapist portal</h2>
        <div className="mt-5">
          <HandoffScene className="w-full max-w-sm text-forest" />
        </div>
        <Signup onDone={(t) => update({ portal: t })} />
        <div className="mt-6">
          <ScreeningNote />
        </div>
      </AppShell>
    );
  }

  const inbox = state.sentBriefs;

  return (
    <AppShell title="Therapist portal">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg font-bold text-forest">Partner network</p>
          <h2 className="font-display text-4xl font-black tracking-tight">{portal.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Licence {portal.license} · {portal.licenseState.toUpperCase()}
            {portal.practice ? ` · ${portal.practice}` : ""}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-3xl border-2 border-border bg-primary/40 p-5 text-sm font-semibold">
        Verification submitted {new Date(portal.verifiedAt).toLocaleDateString()}. Briefs are
        {portal.acceptsBriefs ? " being routed to you." : " paused for your account."}
      </div>

      <section className="card-soft mt-6 p-6">
        <h3 className="font-display text-2xl font-bold">Brief inbox</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Self-report summaries, written by the person and reviewed by them before sending. Nothing
          here is a diagnosis or a score.
        </p>
        {inbox.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-muted p-4 text-sm font-semibold">
            No briefs yet. When someone sends one, it appears here with the date they sent it.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {inbox
              .slice()
              .reverse()
              .map((b) => {
                const confirmed = state.portalReceipts[b.at];
                return (
                  <li key={b.at} className="rounded-2xl border-2 border-border bg-card p-4">
                    <p className="font-display text-lg font-bold">
                      {b.kind === "update" ? "Update since last brief" : "New self-report brief"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Sent {new Date(b.at).toLocaleString()} · for {b.therapistName}
                    </p>
                    {confirmed ? (
                      <p className="mt-3 text-sm font-bold text-forest">
                        Receipt confirmed {new Date(confirmed).toLocaleDateString()} — they've been
                        told it arrived.
                      </p>
                    ) : (
                      <PillButton
                        variant="outline"
                        className="mt-3"
                        onClick={() => confirmBriefReceipt(b.at)}
                      >
                        Confirm receipt
                      </PillButton>
                    )}
                  </li>
                );
              })}
          </ul>
        )}
      </section>

      <section className="card-soft mt-4 p-6">
        <h3 className="font-display text-2xl font-bold">Account</h3>
        <div className="mt-4 flex flex-wrap gap-3">
          <PillButton
            variant="outline"
            onClick={() => update({ portal: { ...portal, acceptsBriefs: !portal.acceptsBriefs } })}
          >
            {portal.acceptsBriefs ? "Pause incoming briefs" : "Resume incoming briefs"}
          </PillButton>
          <PillButton variant="outline" onClick={() => update({ portal: null })}>
            Leave the partner network
          </PillButton>
          <Link to="/directory">
            <PillButton variant="outline">View the directory</PillButton>
          </Link>
        </div>
      </section>

      <div className="mt-6">
        <ScreeningNote />
      </div>
    </AppShell>
  );
}
