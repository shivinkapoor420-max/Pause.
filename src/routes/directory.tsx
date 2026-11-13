import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink, Phone } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell, Chip, PillButton, ScreeningNote } from "@/components/app-shell";
import { CornerBotanicals, LeafSprig } from "@/components/illustrations";
import { useApp } from "@/lib/app-state";
import { buildPatterns } from "@/lib/insights";
import {
  allInsurance,
  allIssues,
  directory,
  issuesForPatterns,
  matchesIssues,
  partners,
  servesBand,
  type Therapist,
} from "@/lib/therapists";

export const Route = createFileRoute("/directory")({
  validateSearch: (search: Record<string, unknown>): { issue?: string } =>
    typeof search["issue"] === "string" ? { issue: search["issue"] } : {},

  head: () => ({
    meta: [
      { title: "Therapist directory — Pause." },
      {
        name: "description",
        content:
          "Browse listed therapists by issue, age group, insurance and session cost, then reach out yourself. A smaller partner network can receive your reviewed brief directly.",
      },
      { property: "og:title", content: "Therapist directory — Pause." },
      {
        property: "og:description",
        content:
          "Filter real listed therapists by what you're dealing with, who they see, and what they cost.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Directory,
});

const costBands = [
  { id: "any", label: "Any cost", test: () => true },
  { id: "under120", label: "Under $120", test: (c: number | null) => c !== null && c < 120 },
  {
    id: "120-180",
    label: "$120–180",
    test: (c: number | null) => c !== null && c >= 120 && c <= 180,
  },
  { id: "over180", label: "Over $180", test: (c: number | null) => c !== null && c > 180 },
] as const;

function Card({ t }: { t: Therapist }) {
  const { state, setTherapistNote } = useApp();
  const note = state.therapistNotes[t.id] ?? { contacted: false, note: "" };
  const [open, setOpen] = useState(false);
  return (
    <article className="card-soft p-5">
      <div className="flex items-start gap-4">
        {t.photoUrl ? (
          <img
            src={t.photoUrl}
            alt={`Portrait of ${t.name}`}
            loading="lazy"
            className="size-20 shrink-0 rounded-2xl border-2 border-border object-cover"
          />
        ) : (
          <span className="grid size-20 shrink-0 place-items-center rounded-2xl border-2 border-border bg-primary/50">
            <LeafSprig className="size-10 text-forest" />
          </span>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-xl font-bold">{t.name}</h3>
            {t.partner && (
              <span className="rounded-full border-2 border-ink bg-mustard px-2 py-0.5 text-[0.7rem] font-bold uppercase tracking-wide">
                Partner
              </span>
            )}
            {note.contacted && (
              <span className="rounded-full border-2 border-ink bg-lavender px-2 py-0.5 text-[0.7rem] font-bold uppercase tracking-wide">
                Contacted
              </span>
            )}
            {t.acceptingNewClients && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-[0.7rem] font-bold text-primary-foreground">
                Accepting clients
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-forest">
            {t.credentials || t.jobTitle}
            {t.practiceName ? ` · ${t.practiceName}` : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            {[t.city, t.state].filter(Boolean).join(", ")}
            {t.online ? " · Online" : ""}
            {t.inPerson ? " · In person" : ""}
            {t.sessionCost ? ` · $${t.sessionCost}/session` : ""}
            {t.slidingScale ? " · sliding scale" : ""}
          </p>
        </div>
      </div>

      {t.bio && <p className="mt-3 text-sm text-muted-foreground">{t.bio.slice(0, 240)}…</p>}

      {t.issues.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {t.issues.slice(0, 8).map((i) => (
            <li key={i} className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">
              {i}
            </li>
          ))}
          {t.issues.length > 8 && (
            <li className="px-1 py-1 text-xs text-muted-foreground">+{t.issues.length - 8} more</li>
          )}
        </ul>
      )}

      {t.insurance.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Insurance: {t.insurance.slice(0, 5).join(", ")}
          {t.insurance.length > 5 ? "…" : ""}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {t.phone && (
          <a href={`tel:${t.phone.replace(/[^\d+]/g, "")}`}>
            <PillButton variant="primary" className="px-5 py-2 text-sm">
              <Phone className="size-4" aria-hidden="true" /> Call {t.phone}
            </PillButton>
          </a>
        )}
        {t.profileUrl && (
          <a href={t.profileUrl} target="_blank" rel="noreferrer noopener">
            <PillButton variant="outline" className="px-5 py-2 text-sm">
              <ExternalLink className="size-4" aria-hidden="true" /> View profile
            </PillButton>
          </a>
        )}
        {t.partner && (
          <Link to="/therapist">
            <PillButton variant="coral" className="px-5 py-2 text-sm">
              Send my brief
            </PillButton>
          </Link>
        )}
      </div>

      <div className="mt-4 rounded-2xl border-2 border-border bg-muted p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm font-bold">
            <input
              type="checkbox"
              checked={note.contacted}
              onChange={(e) => setTherapistNote(t.id, { contacted: e.target.checked })}
              className="size-5 accent-forest"
            />
            I've reached out to them
          </label>
          <button
            onClick={() => setOpen((v) => !v)}
            className="text-sm font-bold text-forest underline"
          >
            {open ? "Hide my note" : note.note ? "My note" : "Add a private note"}
          </button>
        </div>
        {open && (
          <>
            <textarea
              value={note.note}
              onChange={(e) => setTherapistNote(t.id, { note: e.target.value })}
              rows={3}
              placeholder="e.g. left a voicemail Tuesday · waitlist until March · felt like a good fit"
              className="mt-3 w-full rounded-xl border-2 border-border bg-card p-3 text-sm font-semibold outline-none focus:border-ink"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Only you can see this. It stays on this device and is never sent to them.
            </p>
          </>
        )}
        {!open && note.note && (
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{note.note}</p>
        )}
      </div>
    </article>
  );
}

function Directory() {
  const { state } = useApp();
  const contactedCount = Object.values(state.therapistNotes).filter((n) => n.contacted).length;
  const { issue: issueParam } = Route.useSearch();
  const band = state.band ?? "adult";
  const patterns = buildPatterns(state);

  const suggested = useMemo(() => issuesForPatterns(patterns.map((p) => p.label)), [patterns]);

  const [tier, setTier] = useState<"general" | "partner">("general");
  const [issues, setIssues] = useState<string[]>(issueParam ? [issueParam] : []);
  const [bandOnly, setBandOnly] = useState(true);
  const [insurance, setInsurance] = useState<string | null>(null);
  const [cost, setCost] = useState<(typeof costBands)[number]["id"]>("any");
  const [online, setOnline] = useState(false);
  const [inPerson, setInPerson] = useState(false);
  const [openOnly, setOpenOnly] = useState(false);
  const [showAllIssues, setShowAllIssues] = useState(false);

  const pool = tier === "partner" ? partners : directory;

  const results = useMemo(() => {
    const band_ = costBands.find((c) => c.id === cost)!;
    return pool.filter(
      (t) =>
        (!bandOnly || servesBand(t, band)) &&
        matchesIssues(t, issues) &&
        (!insurance || t.insurance.includes(insurance)) &&
        band_.test(t.sessionCost) &&
        (!online || t.online) &&
        (!inPerson || t.inPerson) &&
        (!openOnly || t.acceptingNewClients),
    );
  }, [pool, bandOnly, band, issues, insurance, cost, online, inPerson, openOnly]);

  const issueList = showAllIssues ? allIssues : allIssues.slice(0, 18);

  return (
    <AppShell title="Therapist directory">
      <div className="relative">
        <CornerBotanicals corner="top-right" className="text-forest" />
        <h2 className="font-display text-4xl font-black tracking-tight">Find someone real</h2>
        <p className="mt-2 text-muted-foreground">
          Listed therapists, filterable by what you're actually dealing with. Pause. does the
          finding; you decide whether to reach out.
        </p>
      </div>

      {suggested.length > 0 && (
        <section className="mt-5 rounded-3xl border-2 border-border bg-card p-5">
          <p className="font-display text-lg font-bold">From your patterns</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your Patterns Worth Exploring overlap with these areas. Tapping one filters the
            directory — it's a starting point for a conversation, not a diagnosis.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {suggested.map((i) => (
              <Chip
                key={i}
                active={issues.includes(i)}
                onClick={() =>
                  setIssues((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]))
                }
              >
                {i}
              </Chip>
            ))}
          </div>
        </section>
      )}

      <div className="mt-5 flex gap-2">
        <PillButton
          variant={tier === "general" ? "primary" : "outline"}
          className="px-4 py-2 text-sm"
          onClick={() => setTier("general")}
        >
          General directory ({directory.length})
        </PillButton>
        <PillButton
          variant={tier === "partner" ? "primary" : "outline"}
          className="px-4 py-2 text-sm"
          onClick={() => setTier("partner")}
        >
          Partner network ({partners.length})
        </PillButton>
      </div>

      <p className="mt-3 rounded-2xl bg-muted p-4 text-sm">
        {tier === "general" ? (
          <>
            <strong>General directory.</strong> These therapists are listed publicly and haven't
            signed up with Pause., so nothing is ever sent to them automatically — you call them or
            open their profile and reach out yourself.
          </>
        ) : (
          <>
            <strong>Partner network.</strong> Therapists who joined Pause. directly and agreed to
            receive briefs. This is the only tier where your reviewed brief can be sent with one
            tap. It's small on purpose and grows as more clinicians opt in.
          </>
        )}
      </p>

      <section className="card-soft mt-4 p-5">
        <h3 className="font-display text-lg font-bold">Filters</h3>

        <p className="mt-3 text-sm font-bold">What you'd like help with</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {issueList.map((i) => (
            <Chip
              key={i}
              active={issues.includes(i)}
              onClick={() =>
                setIssues((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]))
              }
            >
              {i}
            </Chip>
          ))}
          <button
            onClick={() => setShowAllIssues((v) => !v)}
            className="min-h-11 px-3 text-sm font-bold text-forest underline"
          >
            {showAllIssues ? "Show fewer" : `+${allIssues.length - issueList.length} more`}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Chip active={bandOnly} onClick={() => setBandOnly((v) => !v)}>
            Sees my age group
          </Chip>
          <Chip active={openOnly} onClick={() => setOpenOnly((v) => !v)}>
            Accepting new clients
          </Chip>
          <Chip active={online} onClick={() => setOnline((v) => !v)}>
            Online
          </Chip>
          <Chip active={inPerson} onClick={() => setInPerson((v) => !v)}>
            In person
          </Chip>
        </div>

        <p className="mt-4 text-sm font-bold">Session cost</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {costBands.map((c) => (
            <Chip key={c.id} active={cost === c.id} onClick={() => setCost(c.id)}>
              {c.label}
            </Chip>
          ))}
        </div>

        <label className="mt-4 block">
          <span className="text-sm font-bold">Insurance</span>
          <select
            value={insurance ?? ""}
            onChange={(e) => setInsurance(e.target.value || null)}
            className="mt-2 w-full rounded-2xl border-2 border-border bg-muted px-4 py-3 text-sm font-semibold outline-none focus:border-ink"
          >
            <option value="">Any / self-pay</option>
            {allInsurance.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </label>

        {(issues.length > 0 || insurance || cost !== "any" || online || inPerson || openOnly) && (
          <PillButton
            variant="outline"
            className="mt-4 px-4 py-2 text-sm"
            onClick={() => {
              setIssues([]);
              setInsurance(null);
              setCost("any");
              setOnline(false);
              setInPerson(false);
              setOpenOnly(false);
            }}
          >
            Clear filters
          </PillButton>
        )}
      </section>

      <p className="mt-5 text-sm font-bold text-muted-foreground">
        {results.length} therapist{results.length === 1 ? "" : "s"} match
        {contactedCount > 0 && ` · you've marked ${contactedCount} as contacted`}
      </p>

      <div className="mt-3 grid gap-4">
        {results.length === 0 && (
          <p className="card-soft p-5 text-sm">
            Nothing matches all of those at once. Try loosening a filter — insurance and cost are
            usually the tightest ones.
          </p>
        )}
        {results.map((t) => (
          <Card key={t.id} t={t} />
        ))}
      </div>

      {tier === "partner" && (
        <div className="mt-5">
          <Link to="/therapist">
            <PillButton variant="coral">Review my brief, then send it</PillButton>
          </Link>
        </div>
      )}

      <div className="mt-6 space-y-3">
        <ScreeningNote />
        <p className="text-xs text-muted-foreground">
          General-directory listings come from publicly available professional profiles and are
          shown for reference only. Pause. has no affiliation with them, and nothing about you is
          shared with anyone in this tier.
        </p>
      </div>
    </AppShell>
  );
}
