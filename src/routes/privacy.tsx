import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/public-layout";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy & safety — Pause." }] }),
  component: Privacy,
});

const sections: [string, string[]][] = [
  [
    "What Pause is — and isn't",
    [
      "Pause is a wellness and peer-support tool. It is not a medical device, does not diagnose, and is not therapy or an emergency service.",
      "Pip, the AI companion, is an AI. It listens and reflects; it does not give clinical advice.",
    ],
  ],
  [
    "What we collect",
    [
      "Account details: email, a username, a display name, and your date of birth (to give you the right age experience).",
      "What you choose to add: check-ins, journal entries, conversations with Pip (kept only if you allow Pip to remember), game results, and anything you post in the community.",
      "We do not collect location by default. For ages 4–12, a guardian may switch on one-tap location sharing; only the latest point is kept, never a history.",
    ],
  ],
  [
    "How we use it",
    [
      "Only to run Pause for you: showing your history, insights, garden and achievements, and keeping the community safe.",
      "We never sell data, never show advertising, and never use journals, check-ins or private messages for marketing or profiling.",
    ],
  ],
  [
    "Children and teens",
    [
      "Profiles for under-18s are created by a parent or guardian from their own account, who gives consent on the child's behalf.",
      "Ages 4–7 have no open AI chat, no messaging and no social features. No under-18 can access the adult community, messaging or leaderboards — this is enforced on our servers.",
      "Teens' journals and Pip conversations are private. Guardians see trend summaries only if the teen chooses to share. Safety alerts are the one exception and always reach the guardian.",
    ],
  ],
  [
    "Anonymity in the community",
    [
      "Every adult gets a generated pseudonym. Your real name, email and sign-in username are never shown to other members unless you choose to show your name.",
      "Photos you upload have location and camera metadata removed automatically.",
      "Moderators can see who posted something when investigating a report, and every moderation action is logged.",
    ],
  ],
  [
    "Your rights",
    [
      "Download all your data any time (Settings → Your data).",
      "Delete your account and everything in it, including your family's child profiles (Settings → Delete account).",
      "Withdraw consent for Pip memory or location sharing at any time.",
      "For any other request, use Contact Us and choose 'Privacy or data request'.",
    ],
  ],
  [
    "Security",
    [
      "Passwords are hashed with scrypt; sessions use secure, HTTP-only cookies; every sensitive action is authorised on the server; administrator actions are audit-logged.",
      "Payments are handled by our payment provider — we never see or store card numbers.",
    ],
  ],
];

function Privacy() {
  return (
    <PublicLayout>
      <article className="mx-auto max-w-3xl px-5 py-14">
        <h1 className="font-display text-5xl font-black tracking-tight">Privacy & safety</h1>
        <p className="mt-3 text-muted-foreground">
          The plain-language version. Last updated November 2026.
        </p>
        <div className="mt-8 space-y-6">
          {sections.map(([title, items]) => (
            <section key={title} className="card-soft p-6">
              <h2 className="font-display text-2xl font-bold">{title}</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed">
                {items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <p className="mt-8 text-xs text-muted-foreground">
          This summary describes how the product works. It is not legal advice; the operator of
          Pause should have it reviewed against the laws that apply where they operate (for example
          India's DPDP Act and Rules, and GDPR for EU users) before launch.
        </p>
      </article>
    </PublicLayout>
  );
}
