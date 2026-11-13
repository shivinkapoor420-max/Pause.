import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FlaskConical } from "lucide-react";
import { PublicLayout } from "@/components/public-layout";
import { PillButton } from "@/components/app-shell";
import { ErrorNote } from "@/components/kit";
import { api } from "@/lib/api";

export const Route = createFileRoute("/checkout/sandbox")({
  head: () => ({
    meta: [{ title: "Test checkout — Pause." }, { name: "robots", content: "noindex" }],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    token: typeof s["token"] === "string" ? s["token"] : "",
  }),
  component: SandboxCheckout,
});

/**
 * Local test checkout so the whole subscription lifecycle works with no payment
 * keys. It is labelled as a test everywhere and takes no money. Disabled in
 * production unless PAYMENTS_SANDBOX=true.
 */
function SandboxCheckout() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  const [failed, setFailed] = useState(false);
  let plan = "monthly";
  try {
    plan = JSON.parse(atob(token.split(".")[0]!.replace(/-/g, "+").replace(/_/g, "/"))).p;
  } catch {
    /* ignore */
  }
  const finish = async (outcome: "success" | "fail") => {
    try {
      const r = await api<{ ok: boolean }>("/billing/sandbox/complete", {
        body: { token, outcome },
      });
      if (r.ok) {
        await qc.invalidateQueries();
        navigate({ to: "/billing", search: { status: "success" } as never });
      } else setFailed(true);
    } catch (e) {
      setError(e);
    }
  };
  return (
    <PublicLayout>
      <div className="mx-auto max-w-md px-5 py-14">
        <div className="rounded-2xl border-2 border-dashed border-ink bg-mustard/60 p-4 text-sm font-bold">
          <p className="flex items-center gap-2">
            <FlaskConical className="size-5" /> TEST MODE — no real payment
          </p>
          <p className="mt-1 font-semibold">
            This checkout simulates a payment provider so the subscription flow can be tested
            without keys. No card is taken and no money moves.
          </p>
        </div>
        <div className="card-soft mt-6 p-6">
          <p className="text-sm font-bold text-muted-foreground">Pause Premium</p>
          <p className="font-display text-4xl font-black">
            {plan === "annual" ? "$30 / year" : "$3 / month"}
          </p>
          {failed && (
            <p className="mt-4 rounded-2xl bg-coral/30 p-3 text-sm font-bold">
              Simulated payment declined. Nothing was charged — you can try again.
            </p>
          )}
          <ErrorNote error={error} />
          <div className="mt-6 grid gap-2">
            <PillButton variant="forest" onClick={() => void finish("success")} disabled={!token}>
              Simulate successful payment
            </PillButton>
            <PillButton variant="outline" onClick={() => void finish("fail")} disabled={!token}>
              Simulate declined card
            </PillButton>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
