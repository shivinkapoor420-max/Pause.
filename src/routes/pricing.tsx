import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { PublicLayout } from "@/components/public-layout";
import { PillButton } from "@/components/app-shell";
import { ErrorNote } from "@/components/kit";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Pause." },
      {
        name: "description",
        content:
          "Free forever, or Premium for $3/month or $30/year. Safety and privacy features are always free.",
      },
    ],
  }),
  component: Pricing,
});

const free = [
  "Wellness dashboard",
  "Daily mood check-ins",
  "Pip — 10 messages a day",
  "Journaling",
  "7 calming games",
  "Your growth garden",
  "7- and 30-day insights",
  "Community access (18+)",
  "Blocking, reporting & privacy controls — always",
];
const premium = [
  "Everything in Free",
  "Pip — up to 150 messages a day",
  "All 10 games incl. Rhythm Breeze, Kind Words & Calm Quest",
  "Year-long insights & weekday patterns",
  "Premium themes & personalisation",
  "Unlimited direct messages & group chats",
  "Exclusive communities & events",
  "Opt-in leaderboards (adults)",
  "Covers your family's child profiles",
];

const providerLabel: Record<string, string> = {
  stripe: "Card (Stripe)",
  razorpay: "UPI / Cards (Razorpay)",
  sandbox: "Test checkout (no real charge)",
};

function Pricing() {
  const { user } = useSession();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<"annual" | "monthly">("annual");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const billing = useQuery({
    queryKey: ["billing"],
    queryFn: () => api("/billing"),
    enabled: !!user,
  });
  const providers: string[] = billing.data?.providers ?? [];

  const checkout = async (provider: string) => {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ url: string }>("/billing/checkout", { body: { plan, provider } });
      if (r.url.startsWith("/"))
        navigate({
          to: r.url.split("?")[0]!,
          search: Object.fromEntries(new URLSearchParams(r.url.split("?")[1])) as never,
        });
      else window.location.href = r.url;
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PublicLayout>
      <div className="mx-auto max-w-5xl px-5 py-14">
        <h1 className="text-center font-display text-5xl font-black tracking-tight">
          Simple, kind pricing
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-center text-muted-foreground">
          Everything you need to feel better is free. Premium unlocks more — and keeps Pause
          independent and ad-free.
        </p>

        <div className="mx-auto mt-8 flex w-fit rounded-full border-2 border-ink bg-card p-1">
          {(["monthly", "annual"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPlan(p)}
              className={cn(
                "rounded-full px-5 py-2 font-bold",
                plan === p && "bg-forest text-forest-foreground",
              )}
              aria-pressed={plan === p}
            >
              {p === "monthly" ? "Monthly" : "Annual · save 17%"}
            </button>
          ))}
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="card-soft p-8">
            <h2 className="font-display text-2xl font-bold">Free</h2>
            <p className="mt-2 font-display text-5xl font-black">$0</p>
            <p className="text-sm text-muted-foreground">forever</p>
            <ul className="mt-6 space-y-2">
              {free.map((f) => (
                <li key={f} className="flex gap-2 text-sm font-semibold">
                  <Check className="size-5 shrink-0 text-forest" /> {f}
                </li>
              ))}
            </ul>
            <Link
              to={user ? "/home" : "/signup"}
              className="mt-8 block rounded-full border-2 border-ink py-3 text-center font-bold hover:bg-muted"
            >
              {user ? "You're on Free" : "Start free"}
            </Link>
          </div>

          <div className="relative rounded-[2rem] border-2 border-ink bg-forest p-8 text-forest-foreground shadow-xl">
            <span className="absolute -top-4 right-6 rounded-full bg-mustard px-4 py-1 text-sm font-black text-foreground">
              {plan === "annual" ? "Best value" : "Most flexible"}
            </span>
            <h2 className="flex items-center gap-2 font-display text-2xl font-bold">
              <Sparkles className="size-6" /> Premium
            </h2>
            <p className="mt-2 font-display text-5xl font-black">
              {plan === "annual" ? "$30" : "$3"}
              <span className="text-xl font-bold opacity-80">
                /{plan === "annual" ? "year" : "month"}
              </span>
            </p>
            <p className="text-sm opacity-80">
              {plan === "annual" ? "That's $2.50 a month — 2 months free." : "Cancel any time."}
            </p>
            <ul className="mt-6 space-y-2">
              {premium.map((f) => (
                <li key={f} className="flex gap-2 text-sm font-semibold">
                  <Check className="size-5 shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <div className="mt-8 space-y-2">
              {!user ? (
                <Link
                  to="/signup"
                  className="block rounded-full bg-card py-3 text-center font-bold text-foreground"
                >
                  Create an account to upgrade
                </Link>
              ) : user.premium ? (
                <Link
                  to="/billing"
                  className="block rounded-full bg-card py-3 text-center font-bold text-foreground"
                >
                  You're Premium 💛 — manage
                </Link>
              ) : user.ageGroup !== "adult" ? (
                <p className="rounded-2xl bg-card/20 p-4 text-sm font-semibold">
                  Ask your parent or guardian — their Premium plan covers your profile too.
                </p>
              ) : providers.length === 0 ? (
                <p className="rounded-2xl bg-card/20 p-4 text-sm font-semibold">
                  Payments aren't switched on yet. Please check back soon.
                </p>
              ) : (
                providers.map((p) => (
                  <PillButton
                    key={p}
                    variant="outline"
                    className="w-full text-foreground"
                    disabled={busy}
                    onClick={() => void checkout(p)}
                  >
                    Pay with {providerLabel[p] ?? p}
                  </PillButton>
                ))
              )}
              <ErrorNote error={error} />
            </div>
          </div>
        </div>
        <p className="mx-auto mt-8 max-w-xl text-center text-sm text-muted-foreground">
          Prices in USD; local taxes may apply. We never see or store your card details — payments
          are handled by our payment provider. Safety tools, blocking, reporting and privacy
          controls are free for everyone, always. Children are never charged directly.
        </p>
      </div>
    </PublicLayout>
  );
}
