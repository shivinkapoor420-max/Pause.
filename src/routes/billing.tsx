import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell, PillButton } from "@/components/app-shell";
import { Badge, Card, LoadingCards, PageHeader } from "@/components/kit";
import { api } from "@/lib/api";

export const Route = createFileRoute("/billing")({
  head: () => ({ meta: [{ title: "Premium & billing — Pause." }] }),
  validateSearch: (s: Record<string, unknown>): { status?: string } =>
    typeof s["status"] === "string" ? { status: s["status"] } : {},
  component: Billing,
});

function money(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function Billing() {
  const { status } = Route.useSearch();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["billing"], queryFn: () => api("/billing") });
  const act = async (path: string, body?: unknown) => {
    try {
      const r = await api<{ url?: string }>(path, { body: body ?? {} });
      if (r.url) {
        window.location.href = r.url;
        return;
      }
      await qc.invalidateQueries();
      toast.success("Updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    }
  };
  const d = q.data;
  const sub = d?.subscription;
  return (
    <AppShell title="Premium & billing">
      <PageHeader eyebrow="Your plan" title="Premium & billing" />
      {status === "success" && (
        <p className="mb-5 rounded-2xl border-2 border-forest bg-primary/60 p-4 font-bold">
          🎉 Welcome to Premium — thank you for supporting Pause.
        </p>
      )}
      {q.isLoading ? (
        <LoadingCards n={2} />
      ) : (
        <>
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-muted-foreground">Current plan</p>
                <p className="font-display text-3xl font-black">
                  {d.premium ? "Premium" : "Free"}{" "}
                  {sub && (
                    <Badge tone={sub.status === "active" ? "forest" : "coral"}>
                      {sub.status.replace("_", " ")}
                    </Badge>
                  )}
                  {sub?.provider === "sandbox" && (
                    <Badge tone="premium" className="ml-1">
                      Test mode
                    </Badge>
                  )}
                </p>
                {d.inheritedFromGuardian && (
                  <p className="text-sm">Covered by your guardian's plan. 💛</p>
                )}
                {sub && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {sub.plan === "annual" ? "$30 / year" : "$3 / month"}
                    {sub.currentPeriodEnd &&
                      ` · ${sub.cancelAtPeriodEnd ? "ends" : "renews"} ${new Date(sub.currentPeriodEnd).toLocaleDateString()}`}
                  </p>
                )}
              </div>
              {!d.premium && d.canPurchase && (
                <Link to="/pricing">
                  <PillButton variant="coral">Upgrade</PillButton>
                </Link>
              )}
            </div>
            {sub?.status === "past_due" && (
              <p className="mt-4 rounded-2xl bg-coral/40 p-3 text-sm font-bold">
                Your last payment didn't go through. Update your payment method to keep Premium.
              </p>
            )}
            {sub && (
              <div className="mt-5 flex flex-wrap gap-2">
                {sub.cancelAtPeriodEnd ? (
                  <PillButton variant="forest" onClick={() => void act("/billing/resume")}>
                    Keep Premium
                  </PillButton>
                ) : (
                  <PillButton
                    variant="outline"
                    onClick={() =>
                      confirm(
                        "Cancel at the end of this billing period? You keep Premium until then.",
                      ) && void act("/billing/cancel")
                    }
                  >
                    Cancel plan
                  </PillButton>
                )}
                <PillButton
                  variant="outline"
                  onClick={() =>
                    void act("/billing/change-plan", {
                      plan: sub.plan === "annual" ? "monthly" : "annual",
                    })
                  }
                >
                  Switch to {sub.plan === "annual" ? "monthly" : "annual (save 17%)"}
                </PillButton>
                {sub.canManagePayment && (
                  <PillButton variant="ghost" onClick={() => void act("/billing/portal")}>
                    Update payment method
                  </PillButton>
                )}
              </div>
            )}
          </Card>
          <Card className="mt-5">
            <h2 className="font-display text-xl font-bold">Billing history</h2>
            {d.history.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No payments yet.</p>
            ) : (
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-2">Date</th>
                    <th>Description</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {d.history.map((h: any, i: number) => (
                    <tr key={i} className="border-t border-border">
                      <td className="py-2">{new Date(h.created_at).toLocaleDateString()}</td>
                      <td>
                        {h.description}{" "}
                        {h.kind === "payment_failed" && <Badge tone="coral">failed</Badge>}
                      </td>
                      <td className="text-right font-bold">{money(h.amount_cents, h.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
          <p className="mt-5 text-xs text-muted-foreground">
            We never store card details. Safety tools, blocking, reporting and privacy controls are
            always free.
          </p>
        </>
      )}
    </AppShell>
  );
}
