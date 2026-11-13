import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, MapPin, Play, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell, CrisisBanner, PillButton } from "@/components/app-shell";
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  ErrorNote,
  Field,
  LoadingCards,
  PageHeader,
  Toggle,
  inputCls,
} from "@/components/kit";
import { WeatherIcon } from "@/components/illustrations";
import { api } from "@/lib/api";
import { useSession, ageGroupLabel } from "@/lib/session";
import type { Sky } from "@/lib/app-state";

export const Route = createFileRoute("/family")({
  head: () => ({ meta: [{ title: "Family — Pause." }] }),
  component: Family,
});

function Family() {
  const { user, refresh } = useSession();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["family"],
    queryFn: () => api("/family/children"),
    enabled: user?.ageGroup === "adult",
  });
  const [adding, setAdding] = useState(false);
  const kids: any[] = q.data?.children ?? [];

  if (user && user.ageGroup !== "adult") {
    return (
      <AppShell title="Family">
        <EmptyState
          emoji="👨‍👩‍👧"
          title="Family is for grown-ups"
          body="Your grown-up manages family settings from their account."
        />
      </AppShell>
    );
  }

  return (
    <AppShell title="Family" wide>
      <PageHeader
        eyebrow="Parent & guardian"
        title="Your family"
        subtitle="Create and manage profiles for children aged 4–17. You're the account owner — you give consent, choose what's available, and see age-appropriate summaries."
        action={
          <PillButton variant="coral" onClick={() => setAdding(true)}>
            <Plus className="size-5" /> Add a child
          </PillButton>
        }
      />
      {!user?.hasParentPin && <PinSetup onDone={() => void refresh()} />}
      {adding && (
        <AddChild
          onDone={() => {
            setAdding(false);
            void qc.invalidateQueries({ queryKey: ["family"] });
          }}
          onCancel={() => setAdding(false)}
        />
      )}
      {q.isLoading ? (
        <LoadingCards n={2} />
      ) : kids.length === 0 && !adding ? (
        <EmptyState
          emoji="🧸"
          title="No family profiles yet"
          body="Add a profile for your child. Little ones (4–7) use Pause through your account in child mode; ages 8+ get their own simple sign-in."
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {kids.map((k) => (
            <ChildCard key={k.id} child={k} hasPin={!!user?.hasParentPin} />
          ))}
        </div>
      )}
      <Card className="mt-8">
        <h2 className="font-display text-xl font-bold">How we protect children</h2>
        <ul className="mt-3 grid gap-2 text-sm font-semibold sm:grid-cols-2">
          <li>
            🚫 No access to the adult community, messaging or leaderboards — enforced on our
            servers.
          </li>
          <li>
            🤖 Ages 4–7 never get open AI chat. Ages 8–17 get a stricter Pip with daily limits.
          </li>
          <li>
            🔒 Teen journals and chats are private; you see trends only if they choose to share.
          </li>
          <li>🆘 Safety alerts always reach you, whatever the privacy settings.</li>
          <li>📍 Location sharing is off by default and never kept as a history.</li>
          <li>💳 Children are never charged — your Premium plan covers them.</li>
        </ul>
      </Card>
    </AppShell>
  );
}

function PinSetup({ onDone }: { onDone: () => void }) {
  const [pin, setPin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  return (
    <Card className="mb-6 border-2 border-ink bg-mustard/40">
      <h2 className="font-display text-xl font-bold">First, set a 4-digit parent PIN</h2>
      <p className="mt-1 text-sm">
        You'll need it to leave child mode, so little hands can't wander off.
      </p>
      <form
        className="mt-4 flex flex-wrap items-end gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await api("/auth/parent-pin", { body: { pin, password } });
            toast.success("Parent PIN saved");
            onDone();
          } catch (err) {
            setError(err);
          }
        }}
      >
        <Field label="PIN">
          <input
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            required
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            className={`${inputCls} w-28`}
          />
        </Field>
        <Field label="Your password">
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
            autoComplete="current-password"
          />
        </Field>
        <PillButton type="submit" variant="forest">
          Save PIN
        </PillButton>
      </form>
      <div className="mt-3">
        <ErrorNote error={error} />
      </div>
    </Card>
  );
}

function AddChild({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [f, setF] = useState({ displayName: "", birthDate: "", username: "", password: "" });
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const age = f.birthDate
    ? Math.floor((Date.now() - new Date(f.birthDate).getTime()) / (365.25 * 86400000))
    : null;
  const ownLogin = age !== null && age >= 8;
  return (
    <Card className="mb-6">
      <h2 className="font-display text-2xl font-bold">Add a child's profile</h2>
      <form
        className="mt-4 grid gap-4 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await api("/family/children", {
              body: {
                displayName: f.displayName,
                birthDate: f.birthDate,
                guardianConsent: true,
                ...(ownLogin ? { username: f.username, password: f.password } : {}),
              },
            });
            toast.success(`${f.displayName}'s profile is ready`);
            onDone();
          } catch (err) {
            setError(err);
          }
        }}
      >
        <Field label="First name or nickname">
          <input
            required
            maxLength={40}
            value={f.displayName}
            onChange={(e) => setF({ ...f, displayName: e.target.value })}
            className={inputCls}
          />
        </Field>
        <Field
          label="Date of birth"
          hint={
            age !== null
              ? age < 4 || age > 17
                ? "Profiles are for ages 4–17."
                : `Age ${age} — ${age <= 7 ? "child mode via your account" : "their own sign-in"}`
              : undefined
          }
        >
          <input
            required
            type="date"
            value={f.birthDate}
            onChange={(e) => setF({ ...f, birthDate: e.target.value })}
            className={inputCls}
          />
        </Field>
        {ownLogin && (
          <>
            <Field label="Their username" hint="Letters, numbers, underscores.">
              <input
                required
                minLength={3}
                maxLength={24}
                pattern="[A-Za-z0-9_]+"
                value={f.username}
                onChange={(e) => setF({ ...f, username: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Their password" hint="At least 8 characters. You can reset it any time.">
              <input
                required
                type="password"
                minLength={8}
                value={f.password}
                onChange={(e) => setF({ ...f, password: e.target.value })}
                className={inputCls}
                autoComplete="new-password"
              />
            </Field>
          </>
        )}
        <label className="flex items-start gap-3 rounded-2xl bg-mustard/40 p-4 text-sm font-semibold sm:col-span-2">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-1 size-5"
          />
          I am this child's parent or legal guardian, and I consent to creating a Pause profile for
          them and to Pause processing their wellness data to provide the service.
        </label>
        <div className="sm:col-span-2">
          <ErrorNote error={error} />
        </div>
        <div className="flex gap-2 sm:col-span-2">
          <PillButton type="submit" variant="coral" disabled={!consent}>
            Create profile
          </PillButton>
          <PillButton type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </PillButton>
        </div>
      </form>
    </Card>
  );
}

function ChildCard({ child, hasPin }: { child: any; hasPin: boolean }) {
  const qc = useQueryClient();
  const [controls, setControls] = useState(child.controls);
  const save = async (patch: Record<string, unknown>) => {
    const next = { ...controls, ...patch };
    setControls(next);
    try {
      await api(`/family/children/${child.id}`, { method: "PATCH", body: { controls: patch } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save");
    }
  };
  const startChildMode = async () => {
    try {
      await api(`/auth/child-mode/${child.id}`, { method: "POST" });
      await qc.invalidateQueries();
      window.location.href = "/kid";
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start child mode");
    }
  };
  const s = child.summary ?? {};
  return (
    <Card className="flex flex-col">
      {child.safetyAlert && (
        <div className="mb-4">
          <p className="mb-2 flex items-center gap-2 font-bold text-destructive">
            <AlertTriangle className="size-5" /> A recent check-in suggests {child.displayName} may
            be struggling.
          </p>
          <CrisisBanner compact />
        </div>
      )}
      <div className="flex items-center gap-4">
        <Avatar style={child.avatarStyle} size={56} />
        <div className="flex-1">
          <h3 className="font-display text-2xl font-bold">{child.displayName}</h3>
          <p className="text-sm text-muted-foreground">
            Age {child.age} · {ageGroupLabel[child.ageGroup as keyof typeof ageGroupLabel]}
            {child.ageGroup !== "early" && ` · signs in as @${child.username}`}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Stat n={s.checkins_7d} label="check-ins (7d)" />
        <Stat n={s.activities_7d} label="calm activities" />
        <Stat
          n={Math.round((s.game_seconds_today ?? 0) / 60)}
          label={`min played today${controls.dailyMinutes ? ` / ${controls.dailyMinutes}` : ""}`}
        />
      </div>

      <div className="mt-4">
        <p className="text-sm font-bold">Last two weeks</p>
        {child.sharesTrends ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {child.moods.length === 0 ? (
              <span className="text-sm text-muted-foreground">No check-ins yet.</span>
            ) : (
              child.moods.map((m: { day: string; sky: Sky }) => (
                <WeatherIcon key={m.day} sky={m.sky} className="size-7 text-ink" />
              ))
            )}
          </div>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            🔒 {child.displayName} keeps their check-ins private. You'll still always get safety
            alerts.
          </p>
        )}
      </div>

      <div className="mt-4 divide-y divide-border rounded-2xl bg-muted/50 px-4">
        {child.ageGroup !== "early" && (
          <Toggle
            checked={controls.aiCompanion}
            onChange={(v) => void save({ aiCompanion: v })}
            label="Chat with Pip"
            description="Age-appropriate AI companion with daily limits."
          />
        )}
        <Toggle checked={controls.games} onChange={(v) => void save({ games: v })} label="Games" />
        <Toggle
          checked={controls.journal}
          onChange={(v) => void save({ journal: v })}
          label="Journal & drawing"
        />
        <div className="flex items-center justify-between gap-3 py-3">
          <div>
            <p className="font-bold">Daily game time</p>
            <p className="text-sm text-muted-foreground">
              A gentle guide shown to them; not a hard lock.
            </p>
          </div>
          <select
            value={controls.dailyMinutes}
            onChange={(e) => void save({ dailyMinutes: Number(e.target.value) })}
            className="rounded-xl border-2 border-border bg-card px-2 py-1 font-bold"
          >
            {[15, 30, 45, 60, 90].map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
        </div>
        {child.ageGroup !== "teen" && <LocationToggle child={child} />}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {child.ageGroup === "early" && (
          <PillButton
            variant="coral"
            disabled={!hasPin}
            onClick={() => void startChildMode()}
            title={hasPin ? undefined : "Set a parent PIN first"}
          >
            <Play className="size-5" /> Start child mode
          </PillButton>
        )}
        {child.ageGroup !== "early" && <ResetPassword childId={child.id} />}
        <PillButton
          variant="ghost"
          className="text-destructive"
          onClick={async () => {
            if (
              !confirm(
                `Delete ${child.displayName}'s profile and all of their data? This can't be undone.`,
              )
            )
              return;
            await api(`/family/children/${child.id}`, { method: "DELETE" });
            void qc.invalidateQueries({ queryKey: ["family"] });
          }}
        >
          <Trash2 className="size-4" /> Delete
        </PillButton>
      </div>
    </Card>
  );
}

function LocationToggle({ child }: { child: any }) {
  const [enabled, setEnabled] = useState(!!child.location?.enabled);
  const loc = child.location;
  return (
    <div className="py-3">
      <Toggle
        checked={enabled}
        onChange={async (v) => {
          if (
            v &&
            !confirm(
              "Turn on one-tap location sharing? Your child can choose to send you where they are. Only the latest point is kept — never a history — and you can turn it off any time.",
            )
          )
            return;
          setEnabled(v);
          await api(`/family/children/${child.id}/location`, { body: { enabled: v } }).catch((e) =>
            toast.error(e.message),
          );
        }}
        label="Location check-in (optional)"
        description="Off by default. Your child taps a button to share; nothing is tracked in the background."
      />
      {enabled && loc?.lat && (
        <a
          className="flex items-center gap-1 text-sm font-bold text-forest underline"
          href={`https://www.openstreetmap.org/?mlat=${loc.lat}&mlon=${loc.lng}#map=16/${loc.lat}/${loc.lng}`}
          target="_blank"
          rel="noreferrer"
        >
          <MapPin className="size-4" /> Last shared {new Date(loc.shared_at).toLocaleString()}
        </a>
      )}
    </div>
  );
}

function ResetPassword({ childId }: { childId: string }) {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  if (!open)
    return (
      <PillButton variant="outline" onClick={() => setOpen(true)}>
        Reset their password
      </PillButton>
    );
  return (
    <form
      className="flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await api(`/family/children/${childId}`, { method: "PATCH", body: { password: pw } });
          toast.success("Password updated");
          setOpen(false);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Couldn't update");
        }
      }}
    >
      <input
        type="password"
        minLength={8}
        required
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        placeholder="New password"
        className={`${inputCls} py-2`}
      />
      <PillButton type="submit" variant="forest">
        Save
      </PillButton>
    </form>
  );
}

function Stat({ n, label }: { n: number | undefined; label: string }) {
  return (
    <div className="rounded-2xl bg-muted p-3">
      <p className="font-display text-2xl font-black">{n ?? 0}</p>
      <p className="text-[11px] font-bold text-muted-foreground">{label}</p>
    </div>
  );
}

export { Badge };
