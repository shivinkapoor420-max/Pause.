#!/usr/bin/env node
/**
 * End-to-end API smoke test. Run against a dev server with a fresh-ish DB:
 *   BASE=http://localhost:3000 ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/smoke-test.mjs
 * Needs REQUIRE_EMAIL_VERIFICATION=false on the server (or verifies via DB_URL if given).
 */
const BASE = process.env.BASE ?? "http://localhost:3000";
const API = `${BASE}/api/v1`;
let passed = 0;
let failed = 0;

class Client {
  constructor(name) {
    this.name = name;
    this.cookies = new Map();
  }
  async req(method, path, body, raw) {
    const headers = { origin: BASE };
    if (body !== undefined && !raw) headers["content-type"] = "application/json";
    if (this.cookies.size)
      headers.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
    const res = await fetch(path.startsWith("http") ? path : `${API}${path}`, {
      method,
      headers,
      body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(";");
      const [k, v] = pair.split("=");
      if (v) this.cookies.set(k, v);
      else this.cookies.delete(k);
    }
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: res.status, data };
  }
}

function check(label, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(`  ✗ ${label}`, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : "");
  }
}

const stamp = Date.now().toString(36);
const adultDob = "1994-05-01";

async function main() {
  console.log(`Smoke test against ${API}\n`);

  console.log("Auth + onboarding");
  const alice = new Client("alice");
  let r = await alice.req("POST", "/auth/signup", {
    email: `alice_${stamp}@test.dev`,
    password: "correct-horse-1",
    username: `alice_${stamp}`,
    displayName: "Alice",
    birthDate: adultDob,
    acceptTerms: true,
  });
  check("adult can sign up", r.status === 200 && r.data.user?.ageGroup === "adult", r.data);
  check(
    "adult gets an anonymous community alias",
    typeof r.data.user?.communityAlias === "string" && r.data.user.identityMode === "alias",
    r.data.user,
  );
  r = await new Client("teen").req("POST", "/auth/signup", {
    email: `t_${stamp}@test.dev`,
    password: "correct-horse-1",
    username: `t_${stamp}`,
    displayName: "T",
    birthDate: "2012-01-01",
    acceptTerms: true,
  });
  check(
    "under-18 self-signup is refused (guardian required)",
    r.status === 403 && r.data.code === "guardian_required",
    r.data,
  );
  r = await alice.req("GET", "/auth/me");
  check("session cookie works", r.data.user?.username === `alice_${stamp}`);
  const bad = await new Client("x").req("POST", "/auth/login", {
    login: `alice_${stamp}`,
    password: "wrong-password",
  });
  check("wrong password rejected", bad.status === 401);
  const csrf = await fetch(`${API}/moods`, {
    method: "POST",
    headers: {
      origin: "https://evil.example",
      "content-type": "application/json",
      cookie: [...alice.cookies].map(([k, v]) => `${k}=${v}`).join("; "),
    },
    body: "{}",
  });
  check("cross-site POST blocked", csrf.status === 403);

  console.log("\nWellness data persists server-side");
  r = await alice.req("POST", "/moods", { sky: "rainy", tags: ["work"] });
  check("mood saved", r.status === 200, r.data);
  r = await alice.req("POST", "/journal", {
    kind: "text",
    prompt: "Today",
    body: "Long day at work but I walked home.",
  });
  check("journal saved", r.status === 200, r.data);
  r = await alice.req("GET", "/me/state");
  check(
    "state returns mood + journal",
    r.data.moods?.length === 1 && r.data.journal?.length === 1,
    r.data,
  );
  r = await alice.req("GET", "/journal?q=walked");
  check("journal search works", r.data.entries?.length === 1);
  r = await alice.req("POST", "/activity", { kind: "breathing", ref: "box" });
  r = await alice.req("GET", "/achievements");
  check(
    "achievements + xp awarded",
    r.data.xp > 0 && r.data.achievements.some((a) => a.key === "first_checkin" && a.earnedAt),
    r.data,
  );

  console.log("\nAI companion (offline fallback works without keys)");
  r = await fetch(`${BASE}/api/companion`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: [...alice.cookies].map(([k, v]) => `${k}=${v}`).join("; "),
    },
    body: JSON.stringify({
      messages: [
        {
          id: "1",
          role: "user",
          parts: [{ type: "text", text: "I'm so stressed about the deadline at work" }],
        },
      ],
    }),
  });
  const stream = await r.text();
  check(
    "companion streams a reply",
    r.status === 200 && stream.includes("text-delta"),
    stream.slice(0, 200),
  );

  console.log("\nFamily: parent-managed child profiles");
  r = await alice.req("POST", "/family/children", {
    displayName: "Mo",
    birthDate: "2020-06-01",
    guardianConsent: true,
  });
  check("parent adds a 4–7 profile", r.status === 200, r.data);
  const littleId = r.data.id;
  r = await alice.req("POST", "/family/children", {
    displayName: "Sam",
    birthDate: "2011-03-03",
    username: `sam_${stamp}`,
    password: "sam-password-1",
    guardianConsent: true,
  });
  check("parent adds a teen profile with own login", r.status === 200, r.data);
  r = await alice.req("POST", `/auth/child-mode/${littleId}`);
  check("child mode needs a parent PIN first", r.status === 400 && r.data.code === "pin_required");
  r = await alice.req("POST", "/auth/parent-pin", { pin: "2468", password: "correct-horse-1" });
  check("parent PIN set", r.status === 200, r.data);

  const sam = new Client("sam");
  r = await sam.req("POST", "/auth/login", { login: `sam_${stamp}`, password: "sam-password-1" });
  check("teen logs in", r.status === 200 && r.data.user.ageGroup === "teen", r.data);
  r = await sam.req("GET", "/community/feed");
  check(
    "teen BLOCKED from community feed (server-side)",
    r.status === 403 && r.data.code === "adults_only",
    r.data,
  );
  r = await sam.req("GET", "/messages/conversations");
  check("teen BLOCKED from messaging", r.status === 403);
  r = await sam.req("GET", "/leaderboard?game=memory");
  check("teen BLOCKED from leaderboards", r.status === 403);
  r = await sam.req("POST", "/billing/checkout", { plan: "monthly", provider: "sandbox" });
  check("teen cannot be charged directly", r.status === 403);
  r = await sam.req("GET", "/admin/overview");
  check("teen BLOCKED from admin", r.status === 403);

  r = await alice.req("POST", `/auth/child-mode/${littleId}`);
  check("parent enters child mode", r.status === 200, r.data);
  r = await alice.req("GET", "/auth/me");
  check(
    "session is now the little one, in child mode",
    r.data.user?.ageGroup === "early" && r.data.user.childMode === true,
    r.data,
  );
  r = await fetch(`${BASE}/api/companion`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: [...alice.cookies].map(([k, v]) => `${k}=${v}`).join("; "),
    },
    body: JSON.stringify({ messages: [] }),
  });
  check("4–7 profile has NO open AI chat", r.status === 403);
  r = await alice.req("POST", "/games/results", {
    game: "memory",
    difficulty: "easy",
    score: 10,
    durationS: 40,
  });
  check("child can play games", r.status === 200, r.data);
  r = await alice.req("POST", "/auth/exit-child-mode", { pin: "0000" });
  check("wrong PIN can't leave child mode", r.status === 400);
  r = await alice.req("POST", "/auth/exit-child-mode", { pin: "2468" });
  r = await alice.req("GET", "/auth/me");
  check("correct PIN returns to parent", r.data.user?.username === `alice_${stamp}`, r.data);
  r = await alice.req("GET", "/family/children");
  check("parent sees child summaries", r.data.children?.length === 2, r.data);
  const teenRow = r.data.children?.find((c) => c.ageGroup === "teen");
  check(
    "teen mood trends are private unless shared",
    teenRow && teenRow.sharesTrends === false && teenRow.moods.length === 0,
    teenRow,
  );

  console.log("\nCommunity (verified adults)");
  r = await alice.req("GET", "/community/feed");
  check("adult can read the feed", r.status === 200, r.data);
  r = await alice.req("POST", "/community/posts", { body: "Hello" });
  const verificationEnforced = r.status === 403 && r.data.code === "email_unverified";
  check(
    "posting needs a verified email (or verification disabled)",
    verificationEnforced || r.status === 200,
    r.data,
  );
  if (verificationEnforced) {
    console.log(
      "  (verification is on — skipping posting tests; set REQUIRE_EMAIL_VERIFICATION=false to run them)",
    );
  } else {
    const bob = new Client("bob");
    await bob.req("POST", "/auth/signup", {
      email: `bob_${stamp}@test.dev`,
      password: "correct-horse-2",
      username: `bob_${stamp}`,
      displayName: "Bob Realname",
      birthDate: adultDob,
      acceptTerms: true,
    });
    const bobMe = (await bob.req("GET", "/auth/me")).data.user;
    r = await alice.req("GET", "/community/communities");
    check(
      "default communities exist (incl. recovery)",
      r.data.communities?.some((c) => c.slug === "recovery"),
      r.data,
    );
    r = await alice.req("POST", "/community/c/recovery/join");
    check("join community", r.status === 200);
    const recovery = (await alice.req("GET", "/community/c/recovery")).data.community;
    r = await alice.req("POST", "/community/posts", {
      body: `30 days today #milestone ${stamp}`,
      communityId: recovery.id,
      kind: "milestone",
    });
    check("post in community", r.status === 200 && r.data.status === "visible", r.data);
    const postId = r.data.id;
    r = await alice.req("POST", "/community/posts", {
      body: `I don't want my name on this one ${stamp}`,
      anonymous: true,
    });
    check("anonymous post", r.status === 200, r.data);
    r = await bob.req("GET", "/community/feed?tab=recent");
    const names = r.data.posts?.map((p) => p.author_name) ?? [];
    check(
      "feed never shows real names by default (alias only)",
      !names.includes("Alice") && names.includes("Anonymous member"),
      names,
    );
    check("feed never exposes login usernames", !JSON.stringify(r.data).includes(`alice_${stamp}`));
    r = await bob.req("POST", `/community/posts/${postId}/comments`, { body: "So proud of you!" });
    check("comment", r.status === 200, r.data);
    r = await bob.req("POST", `/community/posts/${postId}/react`, { kind: "celebrate" });
    check("react", r.status === 200);
    r = await alice.req("GET", "/notifications");
    check(
      "author notified of comment/reaction",
      r.data.notifications?.some((n) => n.kind === "community"),
      r.data,
    );
    r = await bob.req("POST", "/community/posts", { body: "kys loser" });
    check(
      "abusive post blocked by filter",
      r.status === 400 && r.data.code === "moderation_blocked",
      r.data,
    );
    r = await bob.req("POST", "/community/posts", { body: "dm me for crypto giveaway, buy now" });
    check("spammy post held for review", r.status === 200 && r.data.status === "pending", r.data);

    console.log("\nMessaging");
    r = await bob.req("POST", "/messages/conversations", {
      handles: [(await alice.req("GET", "/auth/me")).data.user.communityAlias],
    });
    check("start DM by alias", r.status === 200, r.data);
    const conv = r.data.id;
    r = await bob.req("POST", `/messages/conversations/${conv}`, {
      body: "Hi! Saw your milestone.",
    });
    check("send first message (request)", r.status === 200, r.data);
    r = await bob.req("POST", `/messages/conversations/${conv}`, { body: "Second" });
    check(
      "can't spam an unaccepted request",
      r.status === 403 && r.data.code === "request_pending",
      r.data,
    );
    r = await alice.req("GET", "/messages/conversations");
    check(
      "recipient sees pending request",
      r.data.conversations?.[0]?.status === "pending",
      r.data,
    );
    await alice.req("POST", `/messages/conversations/${conv}/request`, { accept: true });
    r = await alice.req("POST", `/messages/conversations/${conv}`, { body: "Thank you 💛" });
    check("reply after accepting", r.status === 200, r.data);
    r = await bob.req("GET", `/messages/conversations/${conv}`);
    check("conversation history", r.data.messages?.length === 2, r.data);
    r = await alice.req("POST", `/community/users/${bobMe.id}/block`);
    check("block user (free)", r.data.blocked === true);
    r = await bob.req("POST", `/messages/conversations/${conv}`, { body: "hello?" });
    check("blocked user can't message", r.status === 403, r.data);
    r = await alice.req("POST", "/reports", {
      targetKind: "user",
      targetId: bobMe.id,
      reason: "harassment",
    });
    check("report user", r.status === 200);
  }

  console.log("\nBilling (sandbox test mode, no real money)");
  r = await alice.req("GET", "/billing");
  check("billing info", r.status === 200 && r.data.providers.includes("sandbox"), r.data);
  r = await alice.req("POST", "/billing/checkout", { plan: "annual", provider: "sandbox" });
  check("checkout session", r.status === 200 && r.data.url.includes("/checkout/sandbox"), r.data);
  const token = decodeURIComponent(r.data.url.split("token=")[1]);
  r = await alice.req("POST", "/billing/sandbox/complete", { token, outcome: "success" });
  check("test payment completes", r.data.ok === true, r.data);
  r = await alice.req("GET", "/auth/me");
  check("premium entitlement active", r.data.user.premium === true);
  r = await sam.req("GET", "/auth/me");
  check("guardian's Premium covers the teen profile", r.data.user.premium === true, r.data);
  r = await alice.req("POST", "/billing/cancel");
  r = await alice.req("GET", "/billing");
  check(
    "cancel at period end keeps access",
    r.data.premium === true && r.data.subscription.cancelAtPeriodEnd === true,
    r.data,
  );
  r = await fetch(`${API}/webhooks/stripe`, {
    method: "POST",
    body: "{}",
    headers: { "stripe-signature": "t=1,v1=abc" },
  });
  check("unsigned webhook rejected", r.status === 400);

  console.log("\nContact + admin");
  r = await new Client("anon").req("POST", "/contact", {
    name: "Visitor",
    email: "v@test.dev",
    topic: "general",
    message: "Hello, I love the app idea!",
  });
  check("contact form (no account needed)", r.status === 200, r.data);
  r = await alice.req("GET", "/admin/overview");
  check("ordinary adult BLOCKED from admin", r.status === 403);
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    const admin = new Client("admin");
    r = await admin.req("POST", "/auth/login", {
      login: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    });
    check("master admin logs in", r.status === 200 && r.data.user.role === "admin", r.data);
    r = await admin.req("GET", "/admin/overview");
    check("admin overview", r.status === 200 && r.data.totals.users > 0, r.data);
    r = await admin.req("GET", "/admin/contact");
    check("admin sees contact messages", r.data.messages?.length > 0);
    r = await admin.req("GET", "/admin/reports");
    check("admin sees reports", Array.isArray(r.data.reports));
  }

  console.log("\nCommunity blog (reviewed before publishing)");
  const visitor = new Client("visitor");
  r = await visitor.req("POST", "/blog", {
    title: `A thought ${stamp}`,
    body: "Some days the quiet is the hardest part, but I am learning to sit with it a little longer each time.",
    topic: "hope",
    adult: true,
  });
  check(
    "anyone 18+ can submit a blog piece",
    r.status === 200 && r.data.status === "pending",
    r.data,
  );
  const blogId = r.data.id;
  r = await visitor.req("GET", `/blog/${blogId}`);
  check("pending piece is NOT public", r.status === 404);
  r = await sam.req("POST", "/blog", {
    title: "teen post",
    body: "x".repeat(60),
    topic: "hope",
    adult: true,
  });
  check("signed-in minors can't submit to the public blog", r.status === 403);
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    const admin = new Client("admin2");
    await admin.req("POST", "/auth/login", {
      login: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    });
    r = await admin.req("POST", `/admin/blog/${blogId}`, { action: "publish" });
    check("admin publishes the piece", r.status === 200, r.data);
    r = await visitor.req("GET", `/blog/${blogId}`);
    check(
      "published piece is public and stays up",
      r.status === 200 && r.data.post.title.includes(stamp),
      r.data,
    );
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
