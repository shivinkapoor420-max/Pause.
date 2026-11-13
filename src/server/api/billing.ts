import { z } from "zod";
import { db } from "../db";
import { requireUser } from "../auth";
import { bad, body, forbidden, json } from "../http";
import { route } from "../router";
import { isPremium } from "../services";
import {
  PRICES,
  availableProviders,
  billingPortal,
  cancelSubscription,
  createCheckout,
  firstTime,
  readSandbox,
  recordBilling,
  resumeSubscription,
  upsertSubscription,
  verifyRazorpaySignature,
  verifyStripeSignature,
  type Plan,
  type ProviderId,
} from "../payments";

async function currentSub(userId: string) {
  const sql = await db();
  const rows =
    await sql`select * from subscriptions where user_id = ${userId} and status in ('active','trialing','past_due','incomplete')
    order by (status = 'active') desc, updated_at desc limit 1`;
  return rows[0] as
    | {
        id: string;
        user_id: string;
        provider: ProviderId;
        provider_sub_id: string;
        provider_customer_id: string | null;
        plan: Plan;
        status: string;
        current_period_end: Date | null;
        cancel_at_period_end: boolean;
      }
    | undefined;
}

route("GET", "/billing", async ({ request }) => {
  const { user } = await requireUser(request);
  const sql = await db();
  const sub = await currentSub(user.id);
  const history =
    await sql`select kind, amount_cents, currency, description, provider, created_at from billing_events where user_id = ${user.id} order by created_at desc limit 50`;
  const inheritedFromGuardian = !!user.guardian_id && (await isPremium(user)) && !sub;
  return {
    premium: await isPremium(user),
    inheritedFromGuardian,
    canPurchase: user.age_group === "adult",
    providers: availableProviders(),
    prices: PRICES,
    subscription: sub
      ? {
          plan: sub.plan,
          status: sub.status,
          provider: sub.provider,
          currentPeriodEnd: sub.current_period_end,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          canManagePayment: sub.provider === "stripe" && !!sub.provider_customer_id,
        }
      : null,
    history,
  };
});

route("POST", "/billing/checkout", async ({ request }) => {
  const auth = await requireUser(request);
  // Minors are never charged directly — a guardian's subscription covers their family profiles.
  if (auth.user.age_group !== "adult" || auth.childMode)
    throw forbidden(
      "Ask your parent or guardian — their Premium plan covers your profile too.",
      "guardian_required",
    );
  const input = await body(
    request,
    z.object({
      plan: z.enum(["monthly", "annual"]),
      provider: z.enum(["stripe", "razorpay", "sandbox"]),
    }),
  );
  if (!availableProviders().includes(input.provider))
    throw bad("That payment method isn't available right now.");
  const existing = await currentSub(auth.user.id);
  if (existing && existing.status === "active")
    throw bad("You already have Premium. Manage it from Billing.");
  try {
    return await createCheckout(auth.user, input.plan, input.provider);
  } catch (e) {
    console.error("[billing] checkout failed", e);
    throw bad("We couldn't start checkout. Please try again in a moment.");
  }
});

route("POST", "/billing/sandbox/complete", async ({ request }) => {
  const auth = await requireUser(request);
  if (!availableProviders().includes("sandbox")) throw forbidden();
  const input = await body(
    request,
    z.object({ token: z.string().max(2000), outcome: z.enum(["success", "fail"]) }),
  );
  const data = readSandbox(input.token);
  if (!data || data.u !== auth.user.id)
    throw bad("This test checkout has expired. Start again from Pricing.");
  const subId = `sandbox_${auth.user.id}_${Date.now()}`;
  if (input.outcome === "fail") {
    await recordBilling(
      auth.user.id,
      "sandbox",
      "payment_failed",
      PRICES[data.p].cents,
      "usd",
      `TEST — ${data.p} plan payment declined`,
    );
    return { ok: false };
  }
  const end = new Date();
  if (data.p === "annual") end.setUTCFullYear(end.getUTCFullYear() + 1);
  else end.setUTCMonth(end.getUTCMonth() + 1);
  await upsertSubscription({
    userId: auth.user.id,
    provider: "sandbox",
    providerSubId: subId,
    plan: data.p,
    status: "active",
    periodEnd: end,
  });
  await recordBilling(
    auth.user.id,
    "sandbox",
    "payment_succeeded",
    PRICES[data.p].cents,
    "usd",
    `TEST — Pause Premium (${data.p})`,
  );
  return { ok: true };
});

route("POST", "/billing/cancel", async ({ request }) => {
  const auth = await requireUser(request);
  const sub = await currentSub(auth.user.id);
  if (!sub) throw bad("No active subscription.");
  await cancelSubscription(sub, true);
  return { ok: true };
});

route("POST", "/billing/resume", async ({ request }) => {
  const auth = await requireUser(request);
  const sub = await currentSub(auth.user.id);
  if (!sub || !sub.cancel_at_period_end) throw bad("Nothing to resume.");
  await resumeSubscription(sub);
  return { ok: true };
});

/** Switch between monthly and annual. */
route("POST", "/billing/change-plan", async ({ request }) => {
  const auth = await requireUser(request);
  const { plan } = await body(request, z.object({ plan: z.enum(["monthly", "annual"]) }));
  const sub = await currentSub(auth.user.id);
  if (!sub) throw bad("No active subscription.");
  if (sub.plan === plan) return { ok: true };
  if (sub.provider === "stripe" && sub.provider_customer_id)
    return { url: await billingPortal(sub.provider_customer_id) };
  if (sub.provider === "sandbox") {
    const sql = await db();
    await sql`update subscriptions set plan = ${plan}, updated_at = now() where id = ${sub.id}`;
    await recordBilling(
      auth.user.id,
      "sandbox",
      "plan_changed",
      0,
      "usd",
      `TEST — switched to ${plan} (applies from next renewal)`,
    );
    return { ok: true };
  }
  // Razorpay: cancel at cycle end and start the new plan.
  await cancelSubscription(sub, true);
  return await createCheckout(auth.user, plan, sub.provider);
});

route("POST", "/billing/portal", async ({ request }) => {
  const auth = await requireUser(request);
  const sub = await currentSub(auth.user.id);
  if (!sub || sub.provider !== "stripe" || !sub.provider_customer_id)
    throw bad("Payment details are managed by your payment provider.");
  return { url: await billingPortal(sub.provider_customer_id) };
});

// ---------------------------------------------------------------- webhooks (signature-verified)
function stripeStatus(
  s: string,
): "active" | "trialing" | "past_due" | "canceled" | "incomplete" | "expired" {
  if (s === "active" || s === "trialing" || s === "past_due" || s === "incomplete") return s;
  if (s === "unpaid") return "past_due";
  if (s === "incomplete_expired") return "expired";
  return "canceled";
}

route("POST", "/webhooks/stripe", async ({ request }) => {
  const payload = await request.text();
  if (!verifyStripeSignature(payload, request.headers.get("stripe-signature")))
    return json({ error: "bad signature" }, { status: 400 });
  const event = JSON.parse(payload) as {
    id: string;
    type: string;
    data: { object: Record<string, any> };
  };
  if (!(await firstTime("stripe", event.id))) return { received: true, duplicate: true };
  const o = event.data.object;
  if (event.type.startsWith("customer.subscription.")) {
    const userId = o["metadata"]?.["user_id"] as string | undefined;
    if (userId) {
      const periodEnd =
        o["current_period_end"] ?? o["items"]?.["data"]?.[0]?.["current_period_end"];
      await upsertSubscription({
        userId,
        provider: "stripe",
        providerSubId: o["id"],
        customerId: o["customer"],
        plan: (o["metadata"]?.["plan"] as Plan) ?? "monthly",
        status:
          event.type === "customer.subscription.deleted" ? "canceled" : stripeStatus(o["status"]),
        periodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
        cancelAtPeriodEnd: !!o["cancel_at_period_end"],
      });
    }
  } else if (event.type === "checkout.session.completed" && o["mode"] === "subscription") {
    const userId = (o["client_reference_id"] ?? o["metadata"]?.["user_id"]) as string | undefined;
    if (userId && o["subscription"]) {
      await upsertSubscription({
        userId,
        provider: "stripe",
        providerSubId: o["subscription"],
        customerId: o["customer"],
        plan: (o["metadata"]?.["plan"] as Plan) ?? "monthly",
        status: "active",
        periodEnd: null,
      });
    }
  } else if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
    const sql = await db();
    const subId = o["subscription"] ?? o["parent"]?.["subscription_details"]?.["subscription"];
    const owner = subId
      ? await sql`select user_id from subscriptions where provider = 'stripe' and provider_sub_id = ${subId}`
      : [];
    await recordBilling(
      (owner[0]?.["user_id"] as string) ?? null,
      "stripe",
      event.type === "invoice.paid" ? "payment_succeeded" : "payment_failed",
      o["amount_paid"] ?? o["amount_due"] ?? 0,
      o["currency"] ?? "usd",
      "Pause Premium",
    );
  }
  return { received: true };
});

route("POST", "/webhooks/razorpay", async ({ request }) => {
  const payload = await request.text();
  if (!verifyRazorpaySignature(payload, request.headers.get("x-razorpay-signature")))
    return json({ error: "bad signature" }, { status: 400 });
  const eventId = request.headers.get("x-razorpay-event-id") ?? "";
  const event = JSON.parse(payload) as {
    event: string;
    payload: Record<string, { entity: Record<string, any> }>;
    created_at: number;
  };
  if (
    !(await firstTime(
      "razorpay",
      eventId || `${event.event}:${event.created_at}:${payload.length}`,
    ))
  )
    return { received: true, duplicate: true };
  const sub = event.payload["subscription"]?.entity;
  if (sub) {
    const userId = sub["notes"]?.["user_id"] as string | undefined;
    if (userId) {
      const map: Record<string, "active" | "past_due" | "canceled" | "expired" | "incomplete"> = {
        "subscription.activated": "active",
        "subscription.charged": "active",
        "subscription.resumed": "active",
        "subscription.pending": "past_due",
        "subscription.halted": "past_due",
        "subscription.paused": "past_due",
        "subscription.cancelled": "canceled",
        "subscription.completed": "expired",
      };
      const status = map[event.event];
      if (status) {
        await upsertSubscription({
          userId,
          provider: "razorpay",
          providerSubId: sub["id"],
          customerId: sub["customer_id"] ?? null,
          plan: (sub["notes"]?.["plan"] as Plan) ?? "monthly",
          status,
          periodEnd: sub["current_end"] ? new Date(sub["current_end"] * 1000) : null,
        });
      }
      const payment = event.payload["payment"]?.entity;
      if (event.event === "subscription.charged" && payment) {
        await recordBilling(
          userId,
          "razorpay",
          "payment_succeeded",
          payment["amount"],
          payment["currency"]?.toLowerCase() ?? "inr",
          "Pause Premium",
        );
      }
      if (event.event === "subscription.halted" || event.event === "subscription.pending") {
        await recordBilling(
          userId,
          "razorpay",
          "payment_failed",
          0,
          "inr",
          "Renewal payment failed",
        );
      }
    }
  }
  return { received: true };
});
