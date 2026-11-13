/**
 * Payment-provider abstraction. Stripe and Razorpay are called over their REST
 * APIs (no SDK dependency). A built-in "sandbox" provider lets the full
 * subscription lifecycle run locally with NO keys and NO real money — it is
 * clearly labelled as test mode in the UI and is disabled in production
 * unless PAYMENTS_SANDBOX=true.
 */
import { createHmac, randomBytes } from "node:crypto";
import { db, env } from "./db";
import { hmacHex, safeEqualHex } from "./crypto";
import { appUrl, grantAchievement, notify } from "./services";
import type { UserRow } from "./auth";

export type Plan = "monthly" | "annual";
export type ProviderId = "stripe" | "razorpay" | "sandbox";

export const PRICES: Record<Plan, { cents: number; label: string; interval: string }> = {
  monthly: { cents: 300, label: "$3", interval: "month" },
  annual: { cents: 3000, label: "$30", interval: "year" },
};

export function availableProviders(): ProviderId[] {
  const out: ProviderId[] = [];
  if (env("STRIPE_SECRET_KEY") && env("STRIPE_PRICE_MONTHLY") && env("STRIPE_PRICE_ANNUAL"))
    out.push("stripe");
  if (
    env("RAZORPAY_KEY_ID") &&
    env("RAZORPAY_KEY_SECRET") &&
    env("RAZORPAY_PLAN_MONTHLY") &&
    env("RAZORPAY_PLAN_ANNUAL")
  )
    out.push("razorpay");
  const sandboxAllowed =
    env("PAYMENTS_SANDBOX") === "true" ||
    (env("NODE_ENV") !== "production" && env("PAYMENTS_SANDBOX") !== "false");
  if (sandboxAllowed) out.push("sandbox");
  return out;
}

const g = globalThis as unknown as { __pauseSecret?: string };
function secret() {
  return env("SESSION_SECRET") || (g.__pauseSecret ??= randomBytes(32).toString("hex"));
}

// ---------------------------------------------------------------- persistence helpers
export async function upsertSubscription(s: {
  userId: string;
  provider: ProviderId;
  providerSubId: string;
  customerId?: string | null;
  plan: Plan;
  status: "incomplete" | "active" | "trialing" | "past_due" | "canceled" | "expired";
  periodEnd: Date | null;
  cancelAtPeriodEnd?: boolean;
}) {
  const sql = await db();
  const before =
    await sql`select status from subscriptions where provider = ${s.provider} and provider_sub_id = ${s.providerSubId}`;
  await sql`insert into subscriptions (user_id, provider, provider_sub_id, provider_customer_id, plan, status, current_period_end, cancel_at_period_end)
    values (${s.userId}, ${s.provider}, ${s.providerSubId}, ${s.customerId ?? null}, ${s.plan}, ${s.status}, ${s.periodEnd}, ${s.cancelAtPeriodEnd ?? false})
    on conflict (provider, provider_sub_id) do update set status = excluded.status, plan = excluded.plan,
      current_period_end = coalesce(excluded.current_period_end, subscriptions.current_period_end),
      cancel_at_period_end = excluded.cancel_at_period_end,
      provider_customer_id = coalesce(excluded.provider_customer_id, subscriptions.provider_customer_id), updated_at = now()`;
  const was = before[0]?.["status"];
  if (s.status === "active" && was !== "active") {
    await notify(
      s.userId,
      "subscription",
      "Welcome to Pause Premium 💛",
      "Everything is unlocked. Thank you for supporting Pause.",
      "/billing",
    );
    await grantAchievement(s.userId, "premium_supporter");
  }
  if (s.status === "past_due" && was !== "past_due") {
    await notify(
      s.userId,
      "subscription",
      "We couldn't take your payment",
      "Please update your payment method to keep Premium.",
      "/billing",
    );
  }
  if (s.status === "canceled" && was !== "canceled") {
    await notify(
      s.userId,
      "subscription",
      "Your Premium plan has ended",
      "Your data and free features stay exactly as they are.",
      "/billing",
    );
  }
}

export async function recordBilling(
  userId: string | null,
  provider: ProviderId,
  kind: string,
  amountCents: number,
  currency: string,
  description: string,
) {
  const sql = await db();
  await sql`insert into billing_events (user_id, provider, kind, amount_cents, currency, description)
    values (${userId}, ${provider}, ${kind}, ${amountCents}, ${currency}, ${description})`;
}

/** Webhook idempotency: returns false if this event was already processed. */
export async function firstTime(provider: ProviderId, eventId: string) {
  const sql = await db();
  const rows =
    await sql`insert into webhook_events (provider, event_id) values (${provider}, ${eventId}) on conflict do nothing returning event_id`;
  return rows.length > 0;
}

// ---------------------------------------------------------------- stripe
async function stripe(path: string, params: Record<string, string> = {}, method = "POST") {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      authorization: `Bearer ${env("STRIPE_SECRET_KEY")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: method === "GET" ? null : new URLSearchParams(params).toString(),
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok)
    throw new Error(
      `Stripe ${path} failed: ${JSON.stringify(data["error"] ?? data).slice(0, 300)}`,
    );
  return data;
}

export function verifyStripeSignature(payload: string, header: string | null) {
  const secretKey = env("STRIPE_WEBHOOK_SECRET");
  if (!secretKey || !header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = parts["t"];
  const sigs = header
    .split(",")
    .filter((p) => p.startsWith("v1="))
    .map((p) => p.slice(3));
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const expected = hmacHex(secretKey, `${t}.${payload}`);
  return sigs.some((s) => safeEqualHex(s, expected));
}

// ---------------------------------------------------------------- razorpay
async function razorpay(path: string, payload: Record<string, unknown> = {}, method = "POST") {
  const auth = Buffer.from(`${env("RAZORPAY_KEY_ID")}:${env("RAZORPAY_KEY_SECRET")}`).toString(
    "base64",
  );
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: { authorization: `Basic ${auth}`, "content-type": "application/json" },
    body: method === "GET" ? null : JSON.stringify(payload),
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok)
    throw new Error(
      `Razorpay ${path} failed: ${JSON.stringify(data["error"] ?? data).slice(0, 300)}`,
    );
  return data;
}

export function verifyRazorpaySignature(payload: string, header: string | null) {
  const s = env("RAZORPAY_WEBHOOK_SECRET");
  if (!s || !header) return false;
  return safeEqualHex(header, hmacHex(s, payload));
}

// ---------------------------------------------------------------- sandbox
export function signSandbox(data: { u: string; p: Plan; exp: number }) {
  const body = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${body}.${createHmac("sha256", secret()).update(body).digest("base64url")}`;
}

export function readSandbox(token: string): { u: string; p: Plan; exp: number } | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret()).update(body).digest("base64url");
  if (expected.length !== sig.length || expected !== sig) return null;
  const data = JSON.parse(Buffer.from(body, "base64url").toString()) as {
    u: string;
    p: Plan;
    exp: number;
  };
  return data.exp > Date.now() ? data : null;
}

// ---------------------------------------------------------------- public API
export async function createCheckout(
  user: UserRow,
  plan: Plan,
  provider: ProviderId,
): Promise<{ url: string }> {
  if (provider === "stripe") {
    const session = await stripe("/checkout/sessions", {
      mode: "subscription",
      "line_items[0][price]":
        plan === "annual" ? env("STRIPE_PRICE_ANNUAL") : env("STRIPE_PRICE_MONTHLY"),
      "line_items[0][quantity]": "1",
      success_url: appUrl("/billing?status=success"),
      cancel_url: appUrl("/pricing?status=cancelled"),
      client_reference_id: user.id,
      ...(user.email ? { customer_email: user.email } : {}),
      "metadata[user_id]": user.id,
      "metadata[plan]": plan,
      "subscription_data[metadata][user_id]": user.id,
      "subscription_data[metadata][plan]": plan,
    });
    return { url: session["url"] as string };
  }
  if (provider === "razorpay") {
    const sub = await razorpay("/subscriptions", {
      plan_id: plan === "annual" ? env("RAZORPAY_PLAN_ANNUAL") : env("RAZORPAY_PLAN_MONTHLY"),
      total_count: plan === "annual" ? 10 : 120,
      customer_notify: 1,
      notes: { user_id: user.id, plan },
    });
    await upsertSubscription({
      userId: user.id,
      provider,
      providerSubId: sub["id"] as string,
      plan,
      status: "incomplete",
      periodEnd: null,
    });
    return { url: sub["short_url"] as string };
  }
  const token = signSandbox({ u: user.id, p: plan, exp: Date.now() + 30 * 60 * 1000 });
  return { url: `/checkout/sandbox?token=${encodeURIComponent(token)}` };
}

export async function cancelSubscription(
  sub: {
    provider: ProviderId;
    provider_sub_id: string;
    user_id: string;
    plan: Plan;
    current_period_end: Date | null;
  },
  atPeriodEnd: boolean,
) {
  if (sub.provider === "stripe") {
    if (atPeriodEnd)
      await stripe(`/subscriptions/${sub.provider_sub_id}`, { cancel_at_period_end: "true" });
    else await stripe(`/subscriptions/${sub.provider_sub_id}`, {}, "DELETE");
  } else if (sub.provider === "razorpay") {
    await razorpay(`/subscriptions/${sub.provider_sub_id}/cancel`, {
      cancel_at_cycle_end: atPeriodEnd ? 1 : 0,
    });
  }
  // Mirror locally right away; the webhook confirms it later for real providers.
  await upsertSubscription({
    userId: sub.user_id,
    provider: sub.provider,
    providerSubId: sub.provider_sub_id,
    plan: sub.plan,
    status: atPeriodEnd ? "active" : "canceled",
    periodEnd: sub.current_period_end,
    cancelAtPeriodEnd: atPeriodEnd,
  });
}

export async function resumeSubscription(sub: {
  provider: ProviderId;
  provider_sub_id: string;
  user_id: string;
  plan: Plan;
  current_period_end: Date | null;
}) {
  if (sub.provider === "stripe")
    await stripe(`/subscriptions/${sub.provider_sub_id}`, { cancel_at_period_end: "false" });
  if (sub.provider === "razorpay")
    throw new Error("Razorpay subscriptions can't be resumed once cancelled — start a new one.");
  await upsertSubscription({
    userId: sub.user_id,
    provider: sub.provider,
    providerSubId: sub.provider_sub_id,
    plan: sub.plan,
    status: "active",
    periodEnd: sub.current_period_end,
    cancelAtPeriodEnd: false,
  });
}

/** Stripe customer portal for payment method updates and plan switches. */
export async function billingPortal(customerId: string) {
  const s = await stripe("/billing_portal/sessions", {
    customer: customerId,
    return_url: appUrl("/billing"),
  });
  return s["url"] as string;
}

export { stripe as stripeRequest };
