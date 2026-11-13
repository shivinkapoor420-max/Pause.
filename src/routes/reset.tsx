import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PublicLayout } from "@/components/public-layout";
import { PillButton } from "@/components/app-shell";
import { ErrorNote, Field, inputCls } from "@/components/kit";
import { api } from "@/lib/api";

export const Route = createFileRoute("/reset")({
  head: () => ({ meta: [{ title: "Choose a new password — Pause." }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    token: typeof s["token"] === "string" ? s["token"] : "",
  }),
  component: Reset,
});

function Reset() {
  const { token } = Route.useSearch();
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<unknown>(null);
  return (
    <PublicLayout>
      <div className="mx-auto max-w-md px-5 py-14">
        <h1 className="font-display text-4xl font-black">Choose a new password</h1>
        {done ? (
          <div className="card-soft mt-6 p-6">
            <p className="font-bold">Password updated ✅</p>
            <p className="mt-2 text-sm text-muted-foreground">
              For safety, you've been signed out everywhere.
            </p>
            <Link to="/login" className="mt-4 inline-block font-bold underline">
              Sign in
            </Link>
          </div>
        ) : (
          <form
            className="card-soft mt-6 space-y-4 p-6"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api("/auth/reset", { body: { token, password } });
                setDone(true);
              } catch (err) {
                setError(err);
              }
            }}
          >
            <Field label="New password" hint="At least 8 characters.">
              <input
                type="password"
                minLength={8}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className={inputCls}
              />
            </Field>
            <ErrorNote error={error} />
            <PillButton type="submit" variant="forest" className="w-full" disabled={!token}>
              Save password
            </PillButton>
          </form>
        )}
      </div>
    </PublicLayout>
  );
}
