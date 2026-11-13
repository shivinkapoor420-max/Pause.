import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PublicLayout } from "@/components/public-layout";
import { PillButton } from "@/components/app-shell";
import { ErrorNote, Field, inputCls } from "@/components/kit";
import { api } from "@/lib/api";

export const Route = createFileRoute("/forgot")({
  head: () => ({ meta: [{ title: "Reset password — Pause." }] }),
  component: Forgot,
});

function Forgot() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<unknown>(null);
  return (
    <PublicLayout>
      <div className="mx-auto max-w-md px-5 py-14">
        <h1 className="font-display text-4xl font-black">Forgot your password?</h1>
        {sent ? (
          <div className="card-soft mt-6 p-6">
            <p className="font-bold">Check your inbox 📬</p>
            <p className="mt-2 text-sm text-muted-foreground">
              If an account uses that email, we've sent a reset link. It's valid for one hour.
            </p>
            <Link to="/login" className="mt-4 inline-block font-bold underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form
            className="card-soft mt-6 space-y-4 p-6"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api("/auth/forgot", { body: { email } });
                setSent(true);
              } catch (err) {
                setError(err);
              }
            }}
          >
            <Field
              label="Email"
              hint="Kids' and teens' passwords are reset by their grown-up from the Family page."
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
              />
            </Field>
            <ErrorNote error={error} />
            <PillButton type="submit" variant="forest" className="w-full">
              Send reset link
            </PillButton>
          </form>
        )}
      </div>
    </PublicLayout>
  );
}
