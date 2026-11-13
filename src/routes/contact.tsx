import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { LifeBuoy, Mail, MessageSquareHeart, ShieldCheck } from "lucide-react";
import { PublicLayout } from "@/components/public-layout";
import { PillButton } from "@/components/app-shell";
import { ErrorNote, Field, inputCls } from "@/components/kit";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact us — Pause." },
      {
        name: "description",
        content:
          "Questions, feedback, privacy requests or safety concerns — we read every message.",
      },
    ],
  }),
  component: Contact,
});

const topics = [
  ["general", "General question"],
  ["support", "Help using Pause"],
  ["billing", "Billing & subscriptions"],
  ["privacy", "Privacy or data request"],
  ["safety", "Report a safety concern"],
  ["partnership", "Partnerships & schools"],
  ["feedback", "Feedback & ideas"],
] as const;

function Contact() {
  const { user } = useSession();
  const [form, setForm] = useState({
    name: user?.displayName ?? "",
    email: user?.email ?? "",
    topic: "general",
    message: "",
    website: "",
  });
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  return (
    <PublicLayout>
      <div className="mx-auto grid max-w-5xl gap-8 px-5 py-14 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <h1 className="font-display text-5xl font-black tracking-tight">Contact us</h1>
          <p className="mt-3 text-lg text-muted-foreground">
            Questions, ideas, privacy requests or worries — a real person reads every message.
          </p>
          <ul className="mt-8 space-y-4">
            <li className="flex gap-3">
              <MessageSquareHeart className="mt-1 size-6 shrink-0 text-forest" />
              <span>
                <strong>Support & feedback.</strong> We usually reply within 2 working days.
              </span>
            </li>
            <li className="flex gap-3">
              <ShieldCheck className="mt-1 size-6 shrink-0 text-forest" />
              <span>
                <strong>Privacy requests.</strong> You can also export or delete your data yourself
                any time from Settings.
              </span>
            </li>
            <li className="flex gap-3">
              <Mail className="mt-1 size-6 shrink-0 text-forest" />
              <span>
                <strong>Safety reports.</strong> Use the report button on any post, comment, message
                or profile for the fastest response.
              </span>
            </li>
          </ul>
          <div className="mt-8 rounded-2xl border-2 border-ink bg-coral/60 p-4 text-sm font-semibold">
            <p className="flex items-center gap-2 font-bold">
              <LifeBuoy className="size-5" /> Need help right now?
            </p>
            <p className="mt-1">
              This form isn't monitored around the clock. In a crisis, call your local emergency
              number or a helpline: Tele-MANAS 14416 (India), 988 (US), 116 123 (UK).
            </p>
          </div>
        </div>

        <div className="card-soft p-6">
          {sent ? (
            <div className="py-12 text-center">
              <p className="pop-in text-6xl">💌</p>
              <h2 className="mt-4 font-display text-3xl font-bold">Thank you — message received</h2>
              <p className="mt-2 text-muted-foreground">We'll reply to {form.email} soon.</p>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError(null);
                try {
                  await api("/contact", {
                    body: form.website ? form : { ...form, website: undefined },
                  });
                  setSent(true);
                } catch (err) {
                  setError(err);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Your name">
                  <input
                    required
                    maxLength={80}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className={inputCls}
                    autoComplete="name"
                  />
                </Field>
                <Field label="Email">
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className={inputCls}
                    autoComplete="email"
                  />
                </Field>
              </div>
              <Field label="Topic">
                <select
                  value={form.topic}
                  onChange={(e) => setForm({ ...form, topic: e.target.value })}
                  className={inputCls}
                >
                  {topics.map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Message" hint="Please don't include passwords or card details.">
                <textarea
                  required
                  minLength={10}
                  maxLength={5000}
                  rows={7}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <input
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="hidden"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
              />
              <ErrorNote error={error} />
              <PillButton type="submit" variant="coral" className="w-full" disabled={busy}>
                {busy ? "Sending…" : "Send message"}
              </PillButton>
            </form>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
