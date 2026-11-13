# Pause.

A mental-wellness platform for every age: 4–7 (parent-led), 8–12, 13–17 and adults. It has an AI companion (Pip), mood check-ins, journaling, mindfulness, ten calming games, a growth garden, private recovery trackers, an **anonymous 18+ community** with real-time messaging, a reviewed community blog, subscriptions and an admin dashboard.

**Stack:** React 19, TypeScript, TanStack Start/Router/Query, Tailwind CSS 4, Motion, Radix UI, PostgreSQL. AI runs through any OpenAI-compatible provider, and there's a built-in offline mode.

---

## Quick start (local)

You need Node 20+ and PostgreSQL 14+.

```bash
npm install
cp .env.example .env          # set DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD
createdb pause                # or create the database any way you like
npm run dev                   # http://localhost:3000
```

On the first request the server applies the SQL migrations in `db/migrations/` automatically. It also seeds the default communities and creates the **master admin** account from `ADMIN_EMAIL`/`ADMIN_PASSWORD`. Sign in with those details and open **Admin** in the sidebar. Change the admin password right away.

**No API keys are needed to run everything locally:**
- **Pip:** without an AI key it runs a built-in offline listener (reflective, crisis-aware).
- **Email:** verification and reset links are printed to the server log.
- **Payments:** a clearly labelled **test checkout** simulates the full subscription lifecycle and moves no money.

### Checks

```bash
npm run typecheck
npm run lint
npm run test:smoke   # 70 end-to-end API checks against a running server
```

The smoke test needs a running server with `REQUIRE_EMAIL_VERIFICATION=false`. Pass `ADMIN_EMAIL`/`ADMIN_PASSWORD` in the environment to include the admin checks.

---

## Deploying

`npm run build` produces a standalone Node server in `.output/`. Run it with:

```bash
NODE_ENV=production PORT=3000 node .output/server/index.mjs
```

Pause needs a **long-running Node process**, because it keeps a Postgres connection pool and holds open Server-Sent Event streams for real-time messaging. Good hosts:

| Host | Notes |
| --- | --- |
| Render, Railway, Fly.io | Point at the repo; build `npm ci && npm run build`; start `npm start`. |
| Any VPS / Docker | Same commands; put Nginx or Caddy in front for HTTPS. |
| Database | Supabase, Neon, RDS or self-hosted Postgres. For Supabase use the *Session pooler* URL and `DATABASE_SSL=require`. |

Production checklist:
- Set `APP_URL` to your https URL.
- Set a long random `SESSION_SECRET`.
- Set a strong `ADMIN_PASSWORD`.
- Keep `REQUIRE_EMAIL_VERIFICATION=true` and add `RESEND_API_KEY`.
- Leave `PAYMENTS_SANDBOX` unset.
- Rate limiting is in-memory. If you run more than one instance, move it to Redis (see `src/server/http.ts`).
- Media is stored in Postgres (fine at launch). Move it to object storage (S3, R2 or Supabase Storage) as you grow.

> The Lovable editor's own hosting targets Cloudflare Workers, which can't hold long-lived database or SSE connections. Deploy this version to a Node host as above.

---

## Payments: going live

The code includes a payment-provider abstraction (`src/server/payments.ts`) with Stripe and Razorpay adapters, signed webhook verification, idempotent event handling, entitlements, cancellation and resumption, plan switching and billing history.

**This has not been tested against real provider accounts.** Before taking money, run a full test-mode purchase with your own keys.

**Which provider?** If your business is registered in India, **Razorpay** supports UPI and Indian cards and is usually the easier option. Stripe in India is invite-only for many businesses. For international customers, use **Stripe** if your entity is eligible. You can enable both. Confirm eligibility with each provider for your entity and markets.

**Stripe**
1. Create a product called "Pause Premium" with two recurring prices: $3/month and $30/year.
2. Set `STRIPE_SECRET_KEY`, `STRIPE_PRICE_MONTHLY` and `STRIPE_PRICE_ANNUAL`.
3. Add a webhook to `https://YOUR_DOMAIN/api/v1/webhooks/stripe` for these events:
   - `checkout.session.completed`
   - `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
   - `invoice.paid`, `invoice.payment_failed`
4. Set `STRIPE_WEBHOOK_SECRET`.
5. Turn on the Customer Portal in the Stripe dashboard, for card updates and plan switching.

**Razorpay**
1. Create two Plans (monthly and yearly) in your currency.
2. Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_PLAN_MONTHLY` and `RAZORPAY_PLAN_ANNUAL`.
3. Add a webhook to `https://YOUR_DOMAIN/api/v1/webhooks/razorpay` for the `subscription.*` events.
4. Set `RAZORPAY_WEBHOOK_SECRET`.

Children are never charged directly. A guardian's Premium covers their family profiles. Safety, blocking, reporting and privacy features are never paywalled.

---

## Credentials checklist

| What | Variable(s) | Needed for | Without it |
| --- | --- | --- | --- |
| Postgres | `DATABASE_URL` | Everything | **Required** |
| Admin login | `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Admin dashboard | No admin account |
| Email (Resend) | `RESEND_API_KEY`, `MAIL_FROM` | Verification and password reset emails | Links are logged to the console |
| AI provider | `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` | Full AI conversations | Offline Pip |
| Speech-to-text | `AI_TRANSCRIBE_MODEL`, `VITE_VOICE_ENABLED` | Spoken chat for children | Typing only |
| Stripe | `STRIPE_*` | Card subscriptions | Test checkout (dev only) |
| Razorpay | `RAZORPAY_*` | UPI and card subscriptions (India) | Test checkout (dev only) |

---

## How it's built

```
db/migrations/        SQL schema (Row Level Security enabled on every table)
src/server/           backend: auth, db, payments, AI, moderation, realtime
src/server/api/       JSON API at /api/v1/* (auth, family, wellness, games,
                      community, messages, billing, blog, admin)
src/routes/           pages (file-based routing) + /api/companion streaming
src/components/       UI kit, app shell, games, community components
scripts/smoke-test.mjs  end-to-end API checks
```

### Age groups and safety (enforced on the server)

| Group | How they join | What they get |
| --- | --- | --- |
| 4–7 | A guardian creates the profile and opens **child mode**. A parent PIN is needed to exit. | Feelings cards, stories, games, garden. **No** AI chat, messaging, social features, ads or leaderboards. |
| 8–12 | A guardian creates the profile and gives them their own sign-in. | Stricter Pip with daily limits, games, journal, garden, daily quests. Guardian controls apply. |
| 13–17 | A guardian creates the profile and gives them their own sign-in. | Private journal and Pip, games, achievements. Guardians see trends **only if the teen shares**. Safety alerts always reach the guardian. |
| 18+ | Self sign-up. | Everything, including the anonymous community, messaging and leaderboards (Premium, opt-in). |

Every community, messaging, leaderboard and admin endpoint checks age and role on the server (`requireAdult`, `requireAdmin` in `src/server/auth.ts`). Hiding a page in the UI is never the only protection.

### Anonymity (community)

- Everyone gets a generated pseudonym. Real names, emails and sign-in usernames are never exposed. Members can choose to show their display name.
- Profile pictures are off by default; illustrated avatars are used instead.
- Fully anonymous posts are available, with moderators able to see who posted.
- GPS and other metadata are stripped from uploaded JPEG and PNG images.
- Online status is hidden by default.

### Security and privacy notes

- **Passwords:** scrypt hashing.
- **Sessions:** random 256-bit tokens, stored hashed, in HttpOnly SameSite=Lax cookies.
- **CSRF:** origin checks on every state-changing request.
- **Validation:** every input is validated with zod.
- **SQL:** all queries are parameterised.
- **Rate limits:** on signup, login, posting, messaging, uploads, reports, contact and the blog.
- **Uploads:** checked by magic bytes and size-capped; served with `nosniff` and a CSP.
- **Moderation:** automated filters for abuse and spam. Flagged content is held for human review, and self-harm and underage reports are escalated.
- **Audit log:** admin and moderation actions are recorded.
- **Your data:** export (JSON) and full account deletion, which cascades to child profiles.
- **Pip memory:** opt-in. Transcripts aren't kept for adults without consent.

**Compliance:** this project is designed around data minimisation, guardian consent and age-appropriate design, which are the themes of India's DPDP Act and Rules, GDPR and children's-privacy rules. Building the features is **not** the same as being compliant. Have a lawyer review the privacy policy, consent flows, data-processing agreements (database, email, payment and AI providers) and age verification before launch. The current age check is self-declared date of birth plus guardian attestation; stronger verification may be required for your market.

---

## Personalising

- **Founder photo:** save a photo as `public/founder.jpg` and the About page will show it. Until then, a tasteful placeholder is shown.
- **Founder name:** edit `FOUNDER_NAME` at the top of `src/routes/about.tsx`. The story text is in the same file.
- **Crisis numbers:** see `CrisisBanner` in `src/components/app-shell.tsx`.

## Known gaps and next steps

- Payment adapters have not yet been run against real Stripe or Razorpay accounts (see above).
- Push notifications (mobile and web push) and scheduled reminder emails aren't sent yet. In-app and real-time notifications work.
- Rate limiting is per-instance (in-memory). Use Redis when scaling horizontally.
- The therapist directory and portal screens from the original site still store their data in the user's private profile blob, not dedicated tables.
- Age verification is self-declared. Consider a verification provider for the adult community.
