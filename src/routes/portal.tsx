import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, PillButton } from "@/components/app-shell";
import {
  Badge,
  Card,
  EmptyState,
  ErrorNote,
  Field,
  LoadingCards,
  PageHeader,
  inputCls,
} from "@/components/kit";
import { HandoffScene } from "@/components/illustrations";
import { api, timeAgo } from "@/lib/api";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/portal")({
  head: () => ({
    meta: [
      { title: "Therapist portal — Pause." },
      {
        name: "description",
        content:
          "For licensed clinicians: apply to the Pause partner network, receive self-report briefs written and reviewed by members, and confirm receipt.",
      },
    ],
  }),
  component: Portal,
});

const groups = [
  ["early", "Ages 4–7 (with caregiver)"],
  ["kids", "Ages 8–12"],
  ["teen", "Ages 13–17"],
  ["adult", "Adults"],
] as const;

function Portal() {
  const { user } = useSession();
  const qc = useQueryClient();
  const me = useQuery({
    queryKey: ["portal-me"],
    queryFn: () => api("/portal/me"),
    enabled: user?.ageGroup === "adult",
  });
  const profile = me.data?.profile;
  const verified = profile && (profile.status === "verified" || profile.status === "paused");

  if (user && user.ageGroup !== "adult") {
    return (
      <AppShell title="Therapist portal">
        <EmptyState emoji="🩺" title="The portal is for licensed clinicians" />
      </AppShell>
    );
  }

  return (
    <AppShell title="Therapist portal" wide>
      <PageHeader
        eyebrow="For clinicians"
        title="Therapist portal"
        subtitle="Receive self-report briefs that Pause members write in their own words and review before sending. Briefs are never diagnoses or scores."
      />
      {me.isLoading ? (
        <LoadingCards n={2} />
      ) : !profile || profile.status === "rejected" ? (
        <>
          {profile?.status === "rejected" && (
            <p className="mb-4 rounded-2xl bg-coral/30 p-4 text-sm font-bold">
              Your last application wasn't approved
              {profile.review_note ? `: ${profile.review_note}` : "."} You can update and resubmit
              it below.
            </p>
          )}
          <Apply onDone={() => void qc.invalidateQueries({ queryKey: ["portal-me"] })} />
        </>
      ) : profile.status === "pending" ? (
        <Card className="grid gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <Badge tone="premium">Verification pending</Badge>
            <h2 className="mt-2 font-display text-2xl font-bold">Thanks, {profile.name}</h2>
            <p className="mt-2 text-muted-foreground">
              A Pause administrator is checking licence {profile.license_number} (
              {profile.license_region}). You'll get a notification as soon as you're verified — no
              briefs are routed to you until then.
            </p>
          </div>
          <HandoffScene className="w-48 text-forest" />
        </Card>
      ) : verified ? (
        <Inbox
          profile={profile}
          onChange={() => void qc.invalidateQueries({ queryKey: ["portal-me"] })}
        />
      ) : null}
    </AppShell>
  );
}

function Apply({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({
    name: "",
    credentials: "",
    licenseNumber: "",
    licenseRegion: "",
    practice: "",
    email: "",
    phone: "",
    city: "",
    country: "",
    bio: "",
    issues: "",
    languages: "English",
  });
  const [ages, setAges] = useState<string[]>(["adult"]);
  const [online, setOnline] = useState(true);
  const [inPerson, setInPerson] = useState(false);
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const set =
    (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setF({ ...f, [k]: e.target.value });
  return (
    <Card>
      <h2 className="font-display text-2xl font-bold">Join the partner network</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        An administrator verifies every licence by hand before members can send you anything.
      </p>
      <form
        className="mt-5 grid gap-4 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          try {
            await api("/portal/apply", {
              body: {
                ...f,
                issues: f.issues
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
                languages: f.languages
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
                ageGroups: ages,
                online,
                inPerson,
              },
            });
            toast.success("Application sent for verification");
            onDone();
          } catch (err) {
            setError(err);
          }
        }}
      >
        <Field label="Full name">
          <input required value={f.name} onChange={set("name")} className={inputCls} />
        </Field>
        <Field label="Credentials" hint="e.g. M.Phil Clinical Psychology, RCI-registered">
          <input
            required
            value={f.credentials}
            onChange={set("credentials")}
            className={inputCls}
          />
        </Field>
        <Field label="Licence / registration number">
          <input
            required
            value={f.licenseNumber}
            onChange={set("licenseNumber")}
            className={inputCls}
          />
        </Field>
        <Field label="Issuing body or region" hint="e.g. RCI India, NMC, Illinois">
          <input
            required
            value={f.licenseRegion}
            onChange={set("licenseRegion")}
            className={inputCls}
          />
        </Field>
        <Field label="Practice name">
          <input value={f.practice} onChange={set("practice")} className={inputCls} />
        </Field>
        <Field label="Work email (for brief alerts)" hint="Alerts never contain the brief itself.">
          <input
            required
            type="email"
            value={f.email}
            onChange={set("email")}
            className={inputCls}
          />
        </Field>
        <Field label="City">
          <input value={f.city} onChange={set("city")} className={inputCls} />
        </Field>
        <Field label="Country">
          <input value={f.country} onChange={set("country")} className={inputCls} />
        </Field>
        <Field label="Areas you work with" hint="Comma-separated, e.g. Anxiety, ADHD, Addiction">
          <input value={f.issues} onChange={set("issues")} className={inputCls} />
        </Field>
        <Field label="Languages" hint="Comma-separated">
          <input value={f.languages} onChange={set("languages")} className={inputCls} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Short bio (shown to members)">
            <textarea
              rows={4}
              maxLength={1500}
              value={f.bio}
              onChange={set("bio")}
              className={inputCls}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <p className="text-sm font-bold">Who do you see?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {groups.map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={ages.includes(id)}
                onClick={() =>
                  setAges((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]))
                }
                className={cn(
                  "rounded-full border-2 px-4 py-2 text-sm font-bold",
                  ages.includes(id) ? "border-ink bg-mustard" : "border-border bg-card",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-4 text-sm font-bold">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={online}
                onChange={(e) => setOnline(e.target.checked)}
              />{" "}
              Online sessions
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={inPerson}
                onChange={(e) => setInPerson(e.target.checked)}
              />{" "}
              In person
            </label>
          </div>
        </div>
        <label className="flex items-start gap-3 rounded-2xl bg-mustard/40 p-4 text-sm font-semibold sm:col-span-2">
          <input
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
            className="mt-1"
          />
          I confirm I hold a current licence or registration to practise, that the details above are
          accurate, and that I'll treat every brief as confidential client information.
        </label>
        <div className="sm:col-span-2">
          <ErrorNote error={error} />
        </div>
        <PillButton
          type="submit"
          variant="coral"
          disabled={!agree || ages.length === 0}
          className="w-fit"
        >
          Submit for verification
        </PillButton>
      </form>
    </Card>
  );
}

function Inbox({ profile, onChange }: { profile: any; onChange: () => void }) {
  const q = useQuery({ queryKey: ["portal-briefs"], queryFn: () => api("/portal/briefs") });
  const [open, setOpen] = useState<string | null>(null);
  const briefs: any[] = q.data?.briefs ?? [];
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div>
        <h2 className="font-display text-2xl font-bold">Brief inbox</h2>
        {q.isLoading ? (
          <LoadingCards n={2} />
        ) : briefs.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              emoji="📬"
              title="No briefs yet"
              body="When a member sends you a brief it appears here, and we'll email you a heads-up (without the content)."
            />
          </div>
        ) : (
          <ul className="mt-3 space-y-3">
            {briefs.map((b) => (
              <li key={b.id}>
                <Card>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={b.kind === "update" ? "lavender" : "forest"}>
                      {b.kind === "update" ? "Update" : "New brief"}
                    </Badge>
                    <span className="text-sm font-bold">{b.from_name}</span>
                    <span className="text-xs text-muted-foreground">{timeAgo(b.created_at)}</span>
                    {b.confirmed_at && (
                      <span className="ml-auto text-xs font-bold text-forest">
                        Receipt confirmed ✓
                      </span>
                    )}
                  </div>
                  {open === b.id ? (
                    <pre className="mt-3 max-h-[60vh] overflow-y-auto rounded-2xl bg-muted p-4 text-xs leading-relaxed whitespace-pre-wrap">
                      {b.body}
                    </pre>
                  ) : (
                    <button
                      onClick={() => setOpen(b.id)}
                      className="mt-3 text-sm font-bold underline"
                    >
                      Read brief
                    </button>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    Members share contact details inside the brief only if they choose to.
                  </p>
                  {!b.confirmed_at && (
                    <PillButton
                      variant="forest"
                      className="mt-3"
                      onClick={async () => {
                        await api(`/portal/briefs/${b.id}/confirm`, { method: "POST" });
                        toast.success("They've been told it arrived");
                        void q.refetch();
                      }}
                    >
                      Confirm receipt
                    </PillButton>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
      <aside className="space-y-4">
        <Card>
          <Badge tone={profile.status === "verified" ? "forest" : "coral"}>
            {profile.status === "verified" ? "Verified partner" : "Paused by Pause"}
          </Badge>
          <p className="mt-2 font-display text-xl font-bold">{profile.name}</p>
          <p className="text-sm text-muted-foreground">
            {profile.credentials} · {profile.license_region}
          </p>
          <div className="mt-4 grid gap-2">
            <PillButton
              variant="outline"
              onClick={() =>
                void api("/portal/me", {
                  method: "PATCH",
                  body: { acceptsBriefs: !profile.accepts_briefs },
                }).then(onChange)
              }
            >
              {profile.accepts_briefs ? "Pause incoming briefs" : "Resume incoming briefs"}
            </PillButton>
            <PillButton
              variant="ghost"
              className="text-destructive"
              onClick={() =>
                confirm("Leave the partner network? Your inbox will be deleted.") &&
                void api("/portal/me", { method: "PATCH", body: { leave: true } }).then(onChange)
              }
            >
              Leave the network
            </PillButton>
          </div>
        </Card>
        <Link to="/directory" className="block px-2 text-sm font-bold underline">
          View the directory
        </Link>
      </aside>
    </div>
  );
}
