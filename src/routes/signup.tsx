import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PublicLayout } from "@/components/public-layout";
import { PillButton } from "@/components/app-shell";
import { ErrorNote, Field, inputCls } from "@/components/kit";
import { api } from "@/lib/api";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Create your account — Pause." }] }),
  component: Signup,
});

function ageFrom(date: string) {
  if (!date) return null;
  const b = new Date(`${date}T00:00:00`);
  const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate()))
    a--;
  return a;
}

function Signup() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    displayName: "",
    username: "",
    email: "",
    password: "",
    birthDate: "",
  });
  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const age = ageFrom(form.birthDate);
  const minor = age !== null && age < 18;
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/auth/signup", { body: { ...form, acceptTerms: true } });
      await qc.invalidateQueries({ queryKey: ["me"] });
      navigate({ to: "/welcome" });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PublicLayout>
      <div className="mx-auto max-w-lg px-5 py-12">
        <h1 className="font-display text-4xl font-black tracking-tight">Create your Pause</h1>
        <p className="mt-2 text-muted-foreground">Free forever. Takes under a minute.</p>
        <form onSubmit={submit} className="card-soft mt-6 space-y-4 p-6">
          <Field
            label="Date of birth"
            hint="We use this to give you the right experience. It's never shown to anyone."
          >
            <input
              type="date"
              required
              value={form.birthDate}
              onChange={set("birthDate")}
              max={new Date().toISOString().slice(0, 10)}
              className={inputCls}
            />
          </Field>
          {minor ? (
            <div className="rounded-2xl border-2 border-ink bg-lavender/70 p-5">
              <p className="font-display text-xl font-bold">Hi there! 👋</p>
              <p className="mt-2 text-sm font-semibold">
                Pause accounts for under-18s are set up by a parent or guardian, from their own
                account. Ask a grown-up to create a Pause account and add you on their{" "}
                <strong>Family</strong> page — they'll give you your own sign-in
                {age !== null && age >= 8 ? "" : " (or open Pause for you in child mode)"}.
              </p>
              <Link to="/" className="mt-4 inline-block font-bold underline">
                Back to home
              </Link>
            </div>
          ) : (
            <>
              <Field
                label="What should we call you?"
                hint="Private — the community only ever sees your anonymous pseudonym."
              >
                <input
                  required
                  maxLength={60}
                  value={form.displayName}
                  onChange={set("displayName")}
                  autoComplete="given-name"
                  className={inputCls}
                  placeholder="e.g. Jess"
                />
              </Field>
              <Field
                label="Username (for signing in)"
                hint="Letters, numbers and underscores. Never shown publicly."
              >
                <input
                  required
                  minLength={3}
                  maxLength={24}
                  pattern="[A-Za-z0-9_]+"
                  value={form.username}
                  onChange={set("username")}
                  autoComplete="username"
                  className={inputCls}
                />
              </Field>
              <Field label="Email">
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={set("email")}
                  autoComplete="email"
                  className={inputCls}
                />
              </Field>
              <Field label="Password" hint="At least 8 characters.">
                <input
                  required
                  type="password"
                  minLength={8}
                  value={form.password}
                  onChange={set("password")}
                  autoComplete="new-password"
                  className={inputCls}
                />
              </Field>
              <label className="flex items-start gap-3 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={accept}
                  onChange={(e) => setAccept(e.target.checked)}
                  className="mt-1 size-5 accent-[var(--color-forest)]"
                />
                <span>
                  I agree to the{" "}
                  <Link to="/privacy" className="underline">
                    privacy & safety terms
                  </Link>
                  , and I understand Pause is a wellness tool — not a diagnosis, therapy or
                  emergency service.
                </span>
              </label>
              <ErrorNote error={error} />
              <PillButton
                type="submit"
                variant="coral"
                className="w-full"
                disabled={busy || !accept || age === null}
              >
                {busy ? "Creating…" : "Create account"}
              </PillButton>
            </>
          )}
        </form>
        <p className="mt-6 text-center text-sm">
          Already have an account?{" "}
          <Link to="/login" className="font-bold underline">
            Sign in
          </Link>
        </p>
      </div>
    </PublicLayout>
  );
}
