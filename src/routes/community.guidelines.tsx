import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/public-layout";

export const Route = createFileRoute("/community/guidelines")({
  head: () => ({ meta: [{ title: "Community guidelines — Pause." }] }),
  component: Guidelines,
});

const rules: [string, string, string][] = [
  [
    "💛",
    "Be kind",
    "Everyone here is carrying something. Lead with care, especially when you disagree.",
  ],
  [
    "🫥",
    "Protect anonymity",
    "Never try to identify, out or contact anyone outside Pause. Don't share real names, workplaces, schools or meeting locations — yours or anyone else's.",
  ],
  [
    "🤝",
    "Peer support, not professional advice",
    "Share what helped you, not prescriptions. Nobody here is your therapist, doctor or sponsor, and Pause is not a clinical service.",
  ],
  [
    "🚫",
    "No harm",
    "No harassment, hate, sexual content, threats, or encouragement of self-harm, relapse or disordered eating.",
  ],
  [
    "🧹",
    "No spam or selling",
    "No promotion, links farming, or soliciting money or contact details.",
  ],
  [
    "🔞",
    "Adults only",
    "The community is for verified adults (18+). If you think someone is underage, report them — we'll act quickly.",
  ],
  [
    "🆘",
    "In crisis? Reach out",
    "If you or someone else is in danger, contact local emergency services or a helpline. Report posts that worry you — moderators prioritise them.",
  ],
];

function Guidelines() {
  return (
    <PublicLayout>
      <div className="mx-auto max-w-3xl px-5 py-14">
        <h1 className="font-display text-5xl font-black tracking-tight">Community guidelines</h1>
        <p className="mt-3 text-muted-foreground">
          Pause Community is a safe, anonymous place for adults to support each other. These rules
          keep it that way.
        </p>
        <ol className="mt-8 grid gap-4">
          {rules.map(([e, t, b]) => (
            <li key={t} className="card-soft flex gap-4 p-5">
              <span className="text-3xl" aria-hidden="true">
                {e}
              </span>
              <div>
                <h2 className="font-display text-xl font-bold">{t}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{b}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-sm text-muted-foreground">
          Breaking these may lead to content removal, a warning or suspension. Automated filters
          hold some posts for human review.
        </p>
      </div>
    </PublicLayout>
  );
}
