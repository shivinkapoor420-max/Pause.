import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { AppShell, PillButton } from "@/components/app-shell";
import {
  Badge,
  Card,
  EmptyState,
  LoadingCards,
  PageHeader,
  Tabs,
  inputCls,
} from "@/components/kit";
import { api, timeAgo } from "@/lib/api";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";

type Tab =
  | "overview"
  | "reports"
  | "blog"
  | "contact"
  | "users"
  | "communities"
  | "games"
  | "subscriptions"
  | "audit"
  | "therapists";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Pause." }, { name: "robots", content: "noindex" }] }),
  validateSearch: (s: Record<string, unknown>): { tab?: Tab } =>
    typeof s["tab"] === "string" ? { tab: s["tab"] as Tab } : {},
  component: Admin,
});

function Admin() {
  const { user } = useSession();
  const search = Route.useSearch();
  const [tab, setTab] = useState<Tab>(
    search.tab ?? (user?.role === "moderator" ? "reports" : "overview"),
  );
  if (user && user.role !== "admin" && user.role !== "moderator") {
    return (
      <AppShell title="Admin">
        <EmptyState emoji="🔒" title="Administrators only" />
      </AppShell>
    );
  }
  const isAdmin = user?.role === "admin";
  const tabs: { id: Tab; label: string }[] = [
    ...(isAdmin ? [{ id: "overview" as Tab, label: "Overview" }] : []),
    { id: "reports", label: "Reports" },
    { id: "blog", label: "Blog review" },
    ...(isAdmin
      ? ([
          { id: "contact", label: "Contact" },
          { id: "therapists", label: "Therapists" },
          { id: "users", label: "Users" },
          { id: "communities", label: "Communities" },
          { id: "games", label: "Games" },
          { id: "subscriptions", label: "Subscriptions" },
          { id: "audit", label: "Audit log" },
        ] as { id: Tab; label: string }[])
      : []),
  ];
  return (
    <AppShell title="Admin" wide>
      <PageHeader
        eyebrow={isAdmin ? "Master access" : "Moderator"}
        title="Admin dashboard"
        subtitle="Every action here is recorded in the audit log."
      />
      <Tabs className="mb-6" value={tab} onChange={setTab} items={tabs} />
      {tab === "overview" && <Overview />}
      {tab === "reports" && <Reports />}
      {tab === "blog" && <BlogReview />}
      {tab === "contact" && <Contact />}
      {tab === "users" && <Users />}
      {tab === "communities" && <CommunitiesAdmin />}
      {tab === "games" && <GamesAdmin />}
      {tab === "subscriptions" && <Subs />}
      {tab === "audit" && <Audit />}
      {tab === "therapists" && <TherapistsAdmin />}
    </AppShell>
  );
}

const ageName: Record<string, string> = { early: "4–7", kids: "8–12", teen: "13–17", adult: "18+" };
const pieColors = [
  "var(--color-mustard)",
  "var(--color-primary)",
  "var(--color-lavender)",
  "var(--color-coral)",
];

function Overview() {
  const q = useQuery({ queryKey: ["admin-overview"], queryFn: () => api("/admin/overview") });
  if (q.isLoading) return <LoadingCards n={3} />;
  const t = q.data.totals;
  const stats: [string, string | number, string?][] = [
    ["Total users", t.users],
    ["Active today", t.active_day],
    ["Active this week", t.active_week],
    ["New this week", t.new_week],
    ["Premium members", t.premium],
    ["Free members", t.users - t.premium],
    [
      "Revenue (30d, live)",
      `$${(t.live_revenue_30d_cents / 100).toFixed(2)}`,
      t.revenue_30d_cents !== t.live_revenue_30d_cents
        ? `+$${((t.revenue_30d_cents - t.live_revenue_30d_cents) / 100).toFixed(2)} test`
        : undefined,
    ],
    ["Past-due subscriptions", t.past_due],
    ["Open reports", t.open_reports],
    ["New contact messages", t.new_contact],
    ["Posts this week", t.posts_week],
    ["Messages this week", t.messages_week],
  ];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {stats.map(([label, value, note]) => (
          <Card key={label} className="p-4">
            <p className="text-xs font-bold text-muted-foreground">{label}</p>
            <p className="font-display text-3xl font-black">{value}</p>
            {note && <p className="text-xs text-muted-foreground">{note}</p>}
          </Card>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <h2 className="font-display text-lg font-bold">Age groups</h2>
          <div className="h-56">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={q.data.ages.map((a: any) => ({ name: ageName[a.age_group], value: a.n }))}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={45}
                  outerRadius={80}
                  label
                >
                  {q.data.ages.map((_: unknown, i: number) => (
                    <Cell key={i} fill={pieColors[i % 4]} stroke="var(--color-ink)" />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <h2 className="font-display text-lg font-bold">Sign-ups (30 days)</h2>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={q.data.signups}>
                <XAxis dataKey="day" tickFormatter={(d) => String(d).slice(5, 10)} fontSize={11} />
                <YAxis allowDecimals={false} fontSize={11} />
                <Tooltip />
                <Bar dataKey="n" name="Sign-ups" fill="var(--color-forest)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <h2 className="font-display text-lg font-bold">Engagement (30d)</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {q.data.engagement.map((e: any) => (
              <li key={e.kind} className="flex justify-between">
                <span className="capitalize">{e.kind}</span>
                <strong>{e.n}</strong>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="font-display text-lg font-bold">Top games (30d)</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {q.data.topGames.map((g: any) => (
              <li key={g.game} className="flex justify-between">
                <span className="capitalize">{g.game}</span>
                <strong>{g.n}</strong>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="font-display text-lg font-bold">Plans</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {q.data.plans.map((p: any) => (
              <li key={p.plan + p.provider} className="flex justify-between">
                <span>
                  {p.plan} · {p.provider}
                </span>
                <strong>{p.n}</strong>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Reports() {
  const [status, setStatus] = useState<"open" | "actioned" | "dismissed">("open");
  const q = useQuery({
    queryKey: ["admin-reports", status],
    queryFn: () => api(`/admin/reports?status=${status}`),
  });
  const act = async (id: string, action: string) => {
    const note = action === "warn_user" ? (prompt("Message to the member (optional):") ?? "") : "";
    try {
      await api(`/admin/reports/${id}`, { body: { action, note } });
      toast.success("Done");
      void q.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };
  return (
    <div>
      <Tabs
        className="mb-4 w-fit"
        value={status}
        onChange={setStatus}
        items={[
          { id: "open", label: "Open" },
          { id: "actioned", label: "Actioned" },
          { id: "dismissed", label: "Dismissed" },
        ]}
      />
      {q.isLoading ? (
        <LoadingCards n={2} />
      ) : q.data.reports.length === 0 ? (
        <EmptyState emoji="🕊️" title="Nothing to review" />
      ) : (
        <ul className="space-y-3">
          {q.data.reports.map((r: any) => (
            <li key={r.id}>
              <Card
                className={cn(
                  ["self_harm", "underage"].includes(r.reason) && "border-2 border-coral",
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={["self_harm", "underage"].includes(r.reason) ? "coral" : "lavender"}>
                    {r.reason.replace("_", " ")}
                  </Badge>
                  <Badge>{r.target_kind}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {r.reporter ? `by ${r.reporter}` : "automated filter"} · {timeAgo(r.created_at)}
                  </span>
                </div>
                {r.details && <p className="mt-2 text-sm italic">"{r.details}"</p>}
                {r.target ? (
                  <div className="mt-3 rounded-2xl bg-muted p-3 text-sm">
                    <p className="text-xs font-bold text-muted-foreground">
                      {r.target.author} {r.target.anonymous && "(posted anonymously)"}{" "}
                      {r.target.status && `· ${r.target.status}`}{" "}
                      {r.target.ageGroup && `· ${r.target.ageGroup}`}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">{r.target.body || "—"}</p>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">Target no longer exists.</p>
                )}
                {status === "open" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <PillButton
                      variant="outline"
                      className="min-h-9 px-4 py-1.5 text-sm"
                      onClick={() => void act(r.id, "dismiss")}
                    >
                      Dismiss
                    </PillButton>
                    {r.target_kind !== "user" && (
                      <PillButton
                        variant="coral"
                        className="min-h-9 px-4 py-1.5 text-sm"
                        onClick={() => void act(r.id, "remove_content")}
                      >
                        Remove content
                      </PillButton>
                    )}
                    {r.target?.status === "pending" && (
                      <PillButton
                        variant="forest"
                        className="min-h-9 px-4 py-1.5 text-sm"
                        onClick={() => void act(r.id, "restore_content")}
                      >
                        Approve & publish
                      </PillButton>
                    )}
                    <PillButton
                      variant="outline"
                      className="min-h-9 px-4 py-1.5 text-sm"
                      onClick={() => void act(r.id, "warn_user")}
                    >
                      Warn
                    </PillButton>
                    <PillButton
                      variant="ghost"
                      className="min-h-9 px-4 py-1.5 text-sm text-destructive"
                      onClick={() =>
                        confirm("Suspend this account?") && void act(r.id, "suspend_user")
                      }
                    >
                      Suspend
                    </PillButton>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BlogReview() {
  const [status, setStatus] = useState<"pending" | "published" | "rejected">("pending");
  const q = useQuery({
    queryKey: ["admin-blog", status],
    queryFn: () => api(`/admin/blog?status=${status}`),
  });
  const act = async (id: string, action: string) => {
    const note = action === "reject" ? (prompt("Optional note to the writer:") ?? "") : "";
    await api(`/admin/blog/${id}`, { body: { action, note } }).then(() => toast.success("Updated"));
    void q.refetch();
  };
  return (
    <div>
      <Tabs
        className="mb-4 w-fit"
        value={status}
        onChange={setStatus}
        items={[
          { id: "pending", label: "Waiting" },
          { id: "published", label: "Published" },
          { id: "rejected", label: "Rejected" },
        ]}
      />
      {q.isLoading ? (
        <LoadingCards n={2} />
      ) : q.data.posts.length === 0 ? (
        <EmptyState emoji="🪶" title="No blog pieces here" />
      ) : (
        <ul className="space-y-3">
          {q.data.posts.map((p: any) => (
            <li key={p.id}>
              <Card>
                <p className="text-xs font-bold text-muted-foreground">
                  {p.topic} · by {p.pen_name} {p.submitted_by && `(member ${p.submitted_by})`}{" "}
                  {p.contact_email && `· ${p.contact_email}`} · {timeAgo(p.created_at)}
                </p>
                <h3 className="mt-1 font-display text-xl font-bold">{p.title}</h3>
                <p className="mt-2 max-h-60 overflow-y-auto text-sm whitespace-pre-wrap">
                  {p.body}
                </p>
                <div className="mt-3 flex gap-2">
                  {status !== "published" && (
                    <PillButton
                      variant="forest"
                      className="min-h-9 px-4 py-1.5 text-sm"
                      onClick={() => void act(p.id, "publish")}
                    >
                      Publish
                    </PillButton>
                  )}
                  {status === "pending" && (
                    <PillButton
                      variant="outline"
                      className="min-h-9 px-4 py-1.5 text-sm"
                      onClick={() => void act(p.id, "reject")}
                    >
                      Reject
                    </PillButton>
                  )}
                  {status === "published" && (
                    <PillButton
                      variant="outline"
                      className="min-h-9 px-4 py-1.5 text-sm"
                      onClick={() => void act(p.id, "unpublish")}
                    >
                      Unpublish
                    </PillButton>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Contact() {
  const q = useQuery({ queryKey: ["admin-contact"], queryFn: () => api("/admin/contact") });
  const set = (id: string, status: string) =>
    void api(`/admin/contact/${id}`, { method: "PATCH", body: { status } }).then(() => q.refetch());
  if (q.isLoading) return <LoadingCards n={2} />;
  if (q.data.messages.length === 0) return <EmptyState emoji="📭" title="No messages yet" />;
  return (
    <ul className="space-y-3">
      {q.data.messages.map((m: any) => (
        <li key={m.id}>
          <Card className={cn(m.status === "new" && "border-l-4 border-l-coral")}>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={m.topic === "safety" ? "coral" : "lavender"}>{m.topic}</Badge>
              <Badge>{m.status}</Badge>
              <span className="text-xs text-muted-foreground">{timeAgo(m.created_at)}</span>
            </div>
            <p className="mt-2 font-bold">
              {m.name} ·{" "}
              <a
                href={`mailto:${m.email}?subject=${encodeURIComponent("Re: your message to Pause")}`}
                className="underline"
              >
                {m.email}
              </a>
            </p>
            <p className="mt-1 text-sm whitespace-pre-wrap">{m.message}</p>
            <div className="mt-3 flex gap-2">
              {["read", "replied", "archived"].map((s) => (
                <button
                  key={s}
                  onClick={() => set(m.id, s)}
                  className="rounded-full border-2 border-border px-3 py-1 text-xs font-bold capitalize hover:bg-muted"
                >
                  Mark {s}
                </button>
              ))}
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}

function Users() {
  const [search, setSearch] = useState("");
  const q = useQuery({
    queryKey: ["admin-users", search],
    queryFn: () => api(`/admin/users?q=${encodeURIComponent(search)}`),
  });
  const update = async (id: string, body: Record<string, unknown>) => {
    try {
      await api(`/admin/users/${id}`, { method: "PATCH", body });
      toast.success("Updated");
      void q.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };
  return (
    <div>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search email, username, pseudonym…"
        className={cn(inputCls, "mb-4")}
      />
      {q.isLoading ? (
        <LoadingCards n={2} />
      ) : (
        <div className="card-soft overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="p-3">User</th>
                <th>Age</th>
                <th>Plan</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {q.data.users.map((u: any) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="p-3">
                    <p className="font-bold">
                      {u.display_name}{" "}
                      <span className="text-xs text-muted-foreground">@{u.username}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {u.email ?? (u.guardian_id ? "child profile" : "—")}{" "}
                      {u.community_alias && `· ${u.community_alias}`}{" "}
                      {u.reports > 0 && <Badge tone="coral">{u.reports} reports</Badge>}
                    </p>
                  </td>
                  <td>{ageName[u.age_group]}</td>
                  <td>{u.premium ? <Badge tone="premium">Premium</Badge> : "Free"}</td>
                  <td>
                    <select
                      value={u.role}
                      onChange={(e) => void update(u.id, { role: e.target.value })}
                      className="rounded-lg border border-border bg-card px-1 py-0.5"
                      disabled={u.age_group !== "adult"}
                    >
                      <option value="user">user</option>
                      <option value="moderator">moderator</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td>
                    {u.status === "suspended" ? <Badge tone="coral">suspended</Badge> : u.status}
                  </td>
                  <td>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="pr-3">
                    <button
                      onClick={() =>
                        void update(u.id, {
                          status: u.status === "suspended" ? "active" : "suspended",
                        })
                      }
                      className="text-xs font-bold underline"
                    >
                      {u.status === "suspended" ? "Reinstate" : "Suspend"}
                    </button>
                    <button
                      onClick={() => {
                        const d = prompt(
                          "Correct date of birth (YYYY-MM-DD). This changes their age group immediately and is audit-logged.",
                        );
                        if (d) void update(u.id, { birthDate: d.trim() });
                      }}
                      className="ml-3 text-xs font-bold underline"
                    >
                      Age
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CommunitiesAdmin() {
  const q = useQuery({ queryKey: ["admin-communities"], queryFn: () => api("/admin/communities") });
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [premium, setPremium] = useState(false);
  const update = (id: string, body: Record<string, unknown>) =>
    void api(`/admin/communities/${id}`, { method: "PATCH", body }).then(() => q.refetch());
  return (
    <div className="space-y-4">
      <Card>
        <h2 className="font-display text-lg font-bold">Create an official community</h2>
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            await api("/admin/communities", {
              body: { name, description: desc, premium, hue: Math.floor(Math.random() * 360) },
            }).then(() => toast.success("Created"));
            setName("");
            setDesc("");
            void q.refetch();
          }}
        >
          <input
            required
            minLength={3}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className={cn(inputCls, "w-auto flex-1")}
          />
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Description"
            className={cn(inputCls, "w-auto flex-[2]")}
          />
          <label className="flex items-center gap-2 text-sm font-bold">
            <input
              type="checkbox"
              checked={premium}
              onChange={(e) => setPremium(e.target.checked)}
            />{" "}
            Premium
          </label>
          <PillButton type="submit" variant="forest">
            Create
          </PillButton>
        </form>
      </Card>
      {q.data?.communities.map((c: any) => (
        <Card key={c.id} className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-bold">
              {c.name} {c.premium && <Badge tone="premium">Premium</Badge>}{" "}
              {c.status === "archived" && <Badge tone="coral">archived</Badge>}
            </p>
            <p className="text-xs text-muted-foreground">
              /{c.slug} · {c.members} members · {c.posts} posts
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => update(c.id, { premium: !c.premium })}
              className="rounded-full border-2 border-border px-3 py-1 text-xs font-bold"
            >
              {c.premium ? "Make free" : "Make Premium"}
            </button>
            <button
              onClick={() =>
                update(c.id, { status: c.status === "active" ? "archived" : "active" })
              }
              className="rounded-full border-2 border-border px-3 py-1 text-xs font-bold"
            >
              {c.status === "active" ? "Archive" : "Restore"}
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
}

function GamesAdmin() {
  const q = useQuery({ queryKey: ["admin-games"], queryFn: () => api("/admin/games") });
  const update = (id: string, body: { enabled: boolean; premium: boolean }) =>
    void api(`/admin/games/${id}`, { method: "PATCH", body }).then(() => q.refetch());
  if (q.isLoading) return <LoadingCards n={2} />;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {q.data.games.map((g: any) => (
        <Card key={g.id} className="flex items-center gap-4">
          <span className="text-4xl">{g.emoji}</span>
          <div className="flex-1">
            <p className="font-bold">{g.title}</p>
            <p className="text-xs text-muted-foreground">
              Ages {g.ages.map((a: string) => ageName[a]).join(", ")} · {g.plays} plays
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <button
              onClick={() => update(g.id, { enabled: !g.enabled, premium: g.premium })}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-bold",
                g.enabled ? "bg-primary" : "bg-muted",
              )}
            >
              {g.enabled ? "Enabled" : "Disabled"}
            </button>
            <button
              onClick={() => update(g.id, { enabled: g.enabled, premium: !g.premium })}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-bold",
                g.premium ? "bg-mustard" : "bg-muted",
              )}
            >
              {g.premium ? "Premium" : "Free"}
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
}

function Subs() {
  const q = useQuery({ queryKey: ["admin-subs"], queryFn: () => api("/admin/subscriptions") });
  if (q.isLoading) return <LoadingCards n={2} />;
  if (q.data.subscriptions.length === 0)
    return <EmptyState emoji="💳" title="No subscriptions yet" />;
  return (
    <div className="card-soft overflow-x-auto p-0">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-muted text-left">
          <tr>
            <th className="p-3">Member</th>
            <th>Plan</th>
            <th>Provider</th>
            <th>Status</th>
            <th>Renews / ends</th>
          </tr>
        </thead>
        <tbody>
          {q.data.subscriptions.map((s: any, i: number) => (
            <tr key={i} className="border-t border-border">
              <td className="p-3">{s.email ?? s.username}</td>
              <td>{s.plan}</td>
              <td>{s.provider === "sandbox" ? <Badge tone="premium">test</Badge> : s.provider}</td>
              <td>{s.status}</td>
              <td>
                {s.current_period_end ? new Date(s.current_period_end).toLocaleDateString() : "—"}{" "}
                {s.cancel_at_period_end && "(cancelling)"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Audit() {
  const q = useQuery({ queryKey: ["admin-audit"], queryFn: () => api("/admin/audit") });
  if (q.isLoading) return <LoadingCards n={2} />;
  return (
    <ul className="card-soft divide-y divide-border p-0 text-sm">
      {q.data.logs.map((l: any, i: number) => (
        <li key={i} className="flex flex-wrap gap-x-3 p-3">
          <span className="font-bold">{l.action}</span>
          <span className="text-muted-foreground">{l.target}</span>
          <span className="ml-auto text-xs text-muted-foreground">
            {l.actor ?? "system"} · {l.ip} · {new Date(l.created_at).toLocaleString()}
          </span>
        </li>
      ))}
    </ul>
  );
}

function TherapistsAdmin() {
  const [status, setStatus] = useState<"pending" | "verified" | "paused" | "rejected">("pending");
  const q = useQuery({
    queryKey: ["admin-therapists", status],
    queryFn: () => api(`/admin/therapists?status=${status}`),
  });
  const act = async (id: string, action: string) => {
    const note =
      action === "reject" || action === "pause"
        ? (prompt("Note to the clinician (optional):") ?? "")
        : "";
    try {
      await api(`/admin/therapists/${id}`, { body: { action, note } });
      toast.success("Updated");
      void q.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };
  return (
    <div>
      <Tabs
        className="mb-4 w-fit"
        value={status}
        onChange={setStatus}
        items={[
          { id: "pending", label: "Pending" },
          { id: "verified", label: "Verified" },
          { id: "paused", label: "Paused" },
          { id: "rejected", label: "Rejected" },
        ]}
      />
      <p className="mb-4 text-sm text-muted-foreground">
        Check every licence with the issuing body (e.g. the RCI register in India, or the state
        licensing board) before verifying. Verified clinicians receive members' self-report briefs.
      </p>
      {q.isLoading ? (
        <LoadingCards n={2} />
      ) : q.data.therapists.length === 0 ? (
        <EmptyState emoji="🩺" title="Nobody here" />
      ) : (
        <ul className="space-y-3">
          {q.data.therapists.map((t: any) => (
            <li key={t.id}>
              <Card>
                <p className="font-display text-xl font-bold">
                  {t.name}{" "}
                  <span className="text-sm font-semibold text-muted-foreground">
                    {t.credentials}
                  </span>
                </p>
                <p className="mt-1 text-sm">
                  Licence <strong>{t.license_number}</strong> · {t.license_region} ·{" "}
                  {t.practice || "no practice listed"} ·{" "}
                  {[t.city, t.country].filter(Boolean).join(", ")}
                </p>
                <p className="text-sm text-muted-foreground">
                  Work email {t.email} · account {t.account_email} · sees{" "}
                  {t.age_groups.map((a: string) => ageName[a]).join(", ")} · {t.briefs} briefs
                  received
                </p>
                {t.bio && <p className="mt-2 text-sm">{t.bio}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {status !== "verified" && (
                    <PillButton
                      variant="forest"
                      className="min-h-9 px-4 py-1.5 text-sm"
                      onClick={() => void act(t.id, status === "paused" ? "reinstate" : "verify")}
                    >
                      {status === "paused" ? "Reinstate" : "Verify licence"}
                    </PillButton>
                  )}
                  {status === "pending" && (
                    <PillButton
                      variant="outline"
                      className="min-h-9 px-4 py-1.5 text-sm"
                      onClick={() => void act(t.id, "reject")}
                    >
                      Reject
                    </PillButton>
                  )}
                  {status === "verified" && (
                    <PillButton
                      variant="outline"
                      className="min-h-9 px-4 py-1.5 text-sm"
                      onClick={() => void act(t.id, "pause")}
                    >
                      Pause listing
                    </PillButton>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
