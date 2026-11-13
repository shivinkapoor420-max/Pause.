import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PublicLayout } from "@/components/public-layout";
import { PillButton } from "@/components/app-shell";
import { ErrorNote, Field, inputCls } from "@/components/kit";
import { api } from "@/lib/api";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — Pause." }] }),
  validateSearch: (s: Record<string, unknown>): { next?: string } =>
    typeof s["next"] === "string" && s["next"].startsWith("/") && !s["next"].startsWith("//")
      ? { next: s["next"] }
      : {},
  component: Login,
});

function Login() {
  const { next } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/auth/login", { body: { login, password } });
      await qc.invalidateQueries({ queryKey: ["me"] });
      navigate({ to: next ?? "/home" });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PublicLayout>
      <div className="mx-auto max-w-md px-5 py-14">
        <h1 className="font-display text-4xl font-black tracking-tight">Welcome back</h1>
        <p className="mt-2 text-muted-foreground">Sign in with your email or username.</p>
        <form onSubmit={submit} className="card-soft mt-6 space-y-4 p-6">
          <Field label="Email or username">
            <input
              required
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              autoComplete="username"
              className={inputCls}
            />
          </Field>
          <Field label="Password">
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className={inputCls}
            />
          </Field>
          <ErrorNote error={error} />
          <PillButton type="submit" variant="forest" className="w-full" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </PillButton>
          <Link
            to="/forgot"
            className="block text-center text-sm font-bold text-muted-foreground underline"
          >
            Forgot your password?
          </Link>
        </form>
        <p className="mt-6 text-center text-sm">
          New here?{" "}
          <Link to="/signup" className="font-bold underline">
            Create an account
          </Link>
        </p>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Kids and teens: use the username and password your grown-up set up for you.
        </p>
      </div>
    </PublicLayout>
  );
}
