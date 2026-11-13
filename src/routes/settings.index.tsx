import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell, PillButton } from "@/components/app-shell";
import {
  Avatar,
  Badge,
  Card,
  ErrorNote,
  Field,
  PageHeader,
  Toggle,
  avatarStyles,
  inputCls,
} from "@/components/kit";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { currentPushSubscription, disablePush, enablePush, pushSupported } from "@/lib/push";

export const Route = createFileRoute("/settings/")({
  head: () => ({ meta: [{ title: "Settings — Pause." }] }),
  component: Settings,
});

const themes = [
  { id: "meadow", label: "Meadow", sw: ["#B9DCAF", "#F2ECDC", "#2F5741"] },
  { id: "dusk", label: "Dusk", sw: ["#E7C5D6", "#F5EAF0", "#6B3F5E"], premium: true },
  { id: "ocean", label: "Ocean", sw: ["#B4D9E8", "#EAF3F7", "#2F4E6B"], premium: true },
  { id: "midnight", label: "Midnight", sw: ["#2B2D42", "#3A3F5C", "#7CC9A6"], premium: true },
];

function Settings() {
  const { user, refresh } = useSession();
  const qc = useQueryClient();
  if (!user) return <AppShell title="Settings">{null}</AppShell>;
  const adult = user.ageGroup === "adult";
  const patch = async (body: Record<string, unknown>, msg = "Saved") => {
    try {
      await api("/me", { method: "PATCH", body });
      await refresh();
      toast.success(msg);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save");
    }
  };
  const prefs = user.prefs ?? {};

  return (
    <AppShell title="Settings" wide>
      <PageHeader
        title="Settings"
        subtitle="Your profile, privacy and preferences. Safety and privacy controls are always free."
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="font-display text-xl font-bold">You</h2>
          <div className="mt-4 flex items-center gap-4">
            <Avatar
              style={user.avatarStyle}
              imageId={user.identityMode === "name" ? user.avatarId : null}
              size={64}
            />
            <div>
              <p className="font-display text-2xl font-bold">{user.displayName}</p>
              <p className="text-sm text-muted-foreground">
                Signs in as @{user.username} {user.email && `· ${user.email}`}
              </p>
              {user.email && !user.emailVerified && (
                <button
                  className="mt-1 text-sm font-bold text-coral underline"
                  onClick={() =>
                    void api("/auth/resend-verification", { method: "POST" }).then(() =>
                      toast.success("Verification email sent"),
                    )
                  }
                >
                  Verify your email
                </button>
              )}
            </div>
          </div>
          <p className="mt-5 text-sm font-bold">Avatar</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.keys(avatarStyles)
              .filter((k) => k !== "anon")
              .map((k) => (
                <button
                  key={k}
                  onClick={() => void patch({ avatarStyle: k }, "Avatar updated")}
                  aria-label={avatarStyles[k]!.label}
                  aria-pressed={user.avatarStyle === k}
                  className={cn("rounded-full", user.avatarStyle === k && "ring-4 ring-ring")}
                >
                  <Avatar style={k} size={40} />
                </button>
              ))}
          </div>
          <NameForm
            initial={user.displayName}
            bio={user.bio}
            adult={adult}
            onSave={(b) => void patch(b)}
          />
        </Card>

        {adult && (
          <Card>
            <h2 className="font-display text-xl font-bold">Community identity</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Anonymity is the default. Other members only see what's below.
            </p>
            <div className="mt-4 rounded-2xl bg-lavender/60 p-4">
              <p className="text-xs font-bold text-muted-foreground uppercase">Your pseudonym</p>
              <p className="font-display text-2xl font-black">{user.communityAlias}</p>
              <button
                className="mt-1 text-sm font-bold underline"
                onClick={() =>
                  confirm("Get a new random pseudonym? Your old one will stop working in links.") &&
                  void patch({ newAlias: true }, "New pseudonym ready")
                }
              >
                Generate a new one
              </button>
            </div>
            <div className="mt-3 divide-y divide-border">
              <Toggle
                checked={user.identityMode === "name"}
                onChange={(v) =>
                  void patch(
                    { identityMode: v ? "name" : "alias" },
                    v ? "Your display name is now visible" : "Back to anonymous",
                  )
                }
                label="Show my display name instead"
                description="Off by default. Your email and sign-in username are never shown either way."
              />
              <PhotoUploads
                identityMode={user.identityMode}
                avatarId={user.avatarId}
                coverId={user.coverId}
                verified={user.emailVerified}
                onSaved={(b, msg) => void patch(b, msg)}
              />
              <div className="py-3">
                <p className="font-bold">Who can see my profile and posts</p>
                <div className="mt-2 flex gap-2">
                  {(["public", "followers", "private"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => void patch({ profileVisibility: v })}
                      aria-pressed={user.profileVisibility === v}
                      className={cn(
                        "flex-1 rounded-2xl border-2 py-2 text-sm font-bold capitalize",
                        user.profileVisibility === v ? "border-ink bg-mustard" : "border-border",
                      )}
                    >
                      {v === "followers" ? "Followers" : v}
                    </button>
                  ))}
                </div>
              </div>
              <Toggle
                checked={prefs.showOnline === true}
                onChange={(v) => void patch({ prefs: { showOnline: v } })}
                label="Show when I'm online"
                description="Off by default."
              />
              <Toggle
                checked={prefs.readReceipts !== false}
                onChange={(v) => void patch({ prefs: { readReceipts: v } })}
                label="Read receipts"
              />
              <Link to="/settings/blocked" className="block py-3 font-bold underline">
                Blocked & muted members
              </Link>
            </div>
          </Card>
        )}

        <Card>
          <h2 className="font-display text-xl font-bold">Pip & privacy</h2>
          <div className="divide-y divide-border">
            <Toggle
              checked={user.memoryConsent}
              onChange={(v) => void patch({ memoryConsent: v })}
              label="Let Pip remember our conversations"
              description="Uses short recaps so you don't repeat yourself. Off means transcripts aren't kept."
            />
            {user.ageGroup === "teen" && (
              <Toggle
                checked={prefs.shareTrendsWithGuardian === true}
                onChange={(v) =>
                  void api("/me/guardian-sharing", { body: { share: v } }).then(() => refresh())
                }
                label="Share mood trends with my grown-up"
                description="Trends only — never your journal or chats. Safety alerts always reach them."
              />
            )}
          </div>
          <Link to="/profile" className="mt-3 inline-block font-bold underline">
            Accessibility, calm mode & display →
          </Link>
          {adult && (
            <Link to="/portal" className="mt-2 block font-bold underline">
              Are you a licensed therapist? Join the partner network →
            </Link>
          )}
        </Card>

        <Card>
          <h2 className="font-display text-xl font-bold">Notifications</h2>
          <div className="divide-y divide-border">
            <PushToggle />
            <Toggle
              checked={prefs.notifyReminders !== false}
              onChange={(v) => void patch({ prefs: { notifyReminders: v } })}
              label="Gentle check-in reminders"
              description="At most once a day, only if you haven't checked in yet."
            />
            {prefs.notifyReminders !== false && (
              <div className="flex flex-wrap items-center justify-between gap-3 py-3">
                <p className="font-bold">Remind me after</p>
                <input
                  type="time"
                  value={prefs.reminderTime ?? "19:00"}
                  onChange={(e) =>
                    void patch(
                      {
                        prefs: {
                          reminderTime: e.target.value,
                          tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
                        },
                      },
                      "Reminder time saved",
                    )
                  }
                  className="rounded-xl border-2 border-border bg-card px-3 py-1.5 font-bold"
                />
              </div>
            )}
            {user.email && prefs.notifyReminders !== false && (
              <Toggle
                checked={prefs.emailReminders === true}
                onChange={(v) => void patch({ prefs: { emailReminders: v } })}
                label="Also remind me by email"
              />
            )}
            <Toggle
              checked={prefs.notifyAchievements !== false}
              onChange={(v) => void patch({ prefs: { notifyAchievements: v } })}
              label="Achievements"
            />
            {adult && (
              <Toggle
                checked={prefs.notifyCommunity !== false}
                onChange={(v) => void patch({ prefs: { notifyCommunity: v } })}
                label="Community replies & follows"
              />
            )}
            {adult && (
              <Toggle
                checked={prefs.notifyMessages !== false}
                onChange={(v) => void patch({ prefs: { notifyMessages: v } })}
                label="Direct messages"
              />
            )}
            {adult && (
              <Toggle
                checked={prefs.notifyFamily !== false}
                onChange={(v) => void patch({ prefs: { notifyFamily: v } })}
                label="Family activity"
                description="Safety alerts about your children are always sent."
              />
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Security and billing notices are always sent.
          </p>
        </Card>

        {adult && (
          <Card>
            <h2 className="font-display text-xl font-bold">Theme</h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {themes.map((t) => {
                const locked = t.premium && !user.premium;
                return (
                  <button
                    key={t.id}
                    disabled={locked}
                    onClick={() => void patch({ prefs: { theme: t.id } }, `${t.label} theme on`)}
                    aria-pressed={(prefs.theme ?? "meadow") === t.id}
                    className={cn(
                      "rounded-2xl border-2 p-3 text-left disabled:opacity-50",
                      (prefs.theme ?? "meadow") === t.id ? "border-ink" : "border-border",
                    )}
                  >
                    <div className="flex gap-1">
                      {t.sw.map((c) => (
                        <span
                          key={c}
                          className="size-6 rounded-full border border-border"
                          style={{ background: c }}
                        />
                      ))}
                    </div>
                    <p className="mt-2 font-bold">
                      {t.label}{" "}
                      {t.premium && <Badge tone="premium">{locked ? "Premium" : "✦"}</Badge>}
                    </p>
                  </button>
                );
              })}
            </div>
          </Card>
        )}

        <Card>
          <h2 className="font-display text-xl font-bold">Security</h2>
          <PasswordForm />
        </Card>

        <Card>
          <h2 className="font-display text-xl font-bold">Your data</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Download everything we hold about you, or delete it all.
          </p>
          <a href="/api/v1/me/export" className="mt-4 inline-block">
            <PillButton variant="outline">Download my data (JSON)</PillButton>
          </a>
          {!user.childMode && user.email && <DeleteAccount onDone={() => void qc.clear()} />}
        </Card>
      </div>
    </AppShell>
  );
}

function NameForm({
  initial,
  bio: initialBio,
  adult,
  onSave,
}: {
  initial: string;
  bio: string;
  adult: boolean;
  onSave: (b: Record<string, unknown>) => void;
}) {
  const [name, setName] = useState(initial);
  const [bio, setBio] = useState(initialBio);
  return (
    <form
      className="mt-5 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ displayName: name, ...(adult ? { bio } : {}) });
      }}
    >
      <Field
        label="Display name"
        hint={adult ? "Private unless you choose to show it in the community." : undefined}
      >
        <input
          required
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputCls}
        />
      </Field>
      {adult && (
        <Field label="Community bio" hint="Shown on your profile. Avoid identifying details.">
          <textarea
            maxLength={400}
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className={inputCls}
          />
        </Field>
      )}
      <PillButton type="submit" variant="forest">
        Save
      </PillButton>
    </form>
  );
}

function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  return (
    <form
      className="mt-3 space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        try {
          await api("/auth/change-password", { body: { current, password } });
          toast.success("Password changed. Other devices were signed out.");
          setCurrent("");
          setPassword("");
        } catch (err) {
          setError(err);
        }
      }}
    >
      <Field label="Current password">
        <input
          type="password"
          required
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          className={inputCls}
          autoComplete="current-password"
        />
      </Field>
      <Field label="New password">
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputCls}
          autoComplete="new-password"
        />
      </Field>
      <ErrorNote error={error} />
      <PillButton type="submit" variant="outline">
        Change password
      </PillButton>
    </form>
  );
}

function DeleteAccount({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (window.location.hash === "#delete") setOpen(true);
  }, []);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-4 block text-sm font-bold text-destructive underline"
      >
        Delete my account…
      </button>
    );
  return (
    <form
      className="mt-4 space-y-3 rounded-2xl border-2 border-destructive/40 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await api("/me/delete", { body: { password } });
          onDone();
          window.location.href = "/";
        } catch (err) {
          setError(err);
        }
      }}
    >
      <p className="text-sm font-bold">
        This permanently deletes your account, journals, check-ins, posts, messages and any child
        profiles you manage. It can't be undone.
      </p>
      <Field label="Confirm with your password">
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputCls}
        />
      </Field>
      <ErrorNote error={error} />
      <PillButton type="submit" className="bg-destructive text-white">
        Delete everything
      </PillButton>
    </form>
  );
}

function PushToggle() {
  const [on, setOn] = useState(false);
  const [supported, setSupported] = useState(true);
  useEffect(() => {
    setSupported(pushSupported());
    void currentPushSubscription().then((s) => setOn(!!s));
  }, []);
  if (!supported)
    return (
      <p className="py-3 text-sm text-muted-foreground">
        This browser doesn't support notifications.
      </p>
    );
  return (
    <Toggle
      checked={on}
      onChange={async (v) => {
        try {
          if (v) {
            const ok = await enablePush();
            setOn(ok);
            toast[ok ? "success" : "error"](
              ok
                ? "Notifications on for this device"
                : "Notifications were blocked in your browser settings",
            );
          } else {
            await disablePush();
            setOn(false);
          }
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Couldn't change notifications");
        }
      }}
      label="Notifications on this device"
      description="Notification text is fetched privately from Pause — it never passes through push servers."
    />
  );
}

function PhotoUploads({
  identityMode,
  avatarId,
  coverId,
  verified,
  onSaved,
}: {
  identityMode: "alias" | "name";
  avatarId: string | null;
  coverId: string | null;
  verified: boolean;
  onSaved: (b: Record<string, unknown>, msg: string) => void;
}) {
  const upload = async (file: File | undefined, field: "avatarId" | "coverId") => {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Images must be under 4 MB.");
      return;
    }
    try {
      const r = await api<{ id: string }>("/media?scope=public", {
        raw: file,
        headers: { "content-type": file.type },
      });
      onSaved(
        { [field]: r.id },
        field === "avatarId" ? "Profile photo updated" : "Cover image updated",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    }
  };
  if (!verified)
    return (
      <p className="py-3 text-sm text-muted-foreground">
        Verify your email to add a profile photo or cover image.
      </p>
    );
  return (
    <div className="space-y-3 py-3">
      <div>
        <p className="font-bold">Profile photo</p>
        <p className="text-sm text-muted-foreground">
          {identityMode === "name"
            ? "Shown on your profile and posts."
            : "Only shown if you choose to show your name — your illustrated avatar is used otherwise."}{" "}
          Location data is removed automatically.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <label className="cursor-pointer rounded-full border-2 border-ink px-4 py-1.5 text-sm font-bold">
            Upload
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(e) => void upload(e.target.files?.[0], "avatarId")}
            />
          </label>
          {avatarId && (
            <button
              className="text-sm font-bold underline"
              onClick={() => onSaved({ avatarId: null }, "Photo removed")}
            >
              Remove
            </button>
          )}
        </div>
      </div>
      <div>
        <p className="font-bold">Cover image</p>
        <p className="text-sm text-muted-foreground">
          Avoid anything that shows where you live or work.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <label className="cursor-pointer rounded-full border-2 border-ink px-4 py-1.5 text-sm font-bold">
            Upload
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(e) => void upload(e.target.files?.[0], "coverId")}
            />
          </label>
          {coverId && (
            <button
              className="text-sm font-bold underline"
              onClick={() => onSaved({ coverId: null }, "Cover removed")}
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
