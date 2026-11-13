import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { EmptyState, LoadingCards, PageHeader } from "@/components/kit";
import { api, timeAgo } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Pause." }] }),
  component: Notifications,
});

const icon: Record<string, string> = {
  message: "💬",
  community: "🌿",
  achievement: "🏅",
  subscription: "💛",
  security: "🔐",
  reminder: "⏰",
  family: "👨‍👩‍👧",
  moderation: "🛡️",
};

function Notifications() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["notifications"], queryFn: () => api("/notifications") });
  useEffect(() => {
    if (!q.data) return;
    const t = setTimeout(
      () =>
        void api("/notifications/read", { method: "POST" }).then(() =>
          qc.invalidateQueries({ queryKey: ["me"] }),
        ),
      1500,
    );
    return () => clearTimeout(t);
  }, [q.data, qc]);
  const list: any[] = q.data?.notifications ?? [];
  return (
    <AppShell title="Notifications">
      <PageHeader
        title="Notifications"
        subtitle={
          <Link to="/settings" className="underline">
            Choose what you're notified about
          </Link>
        }
      />
      {q.isLoading ? (
        <LoadingCards n={3} />
      ) : list.length === 0 ? (
        <EmptyState emoji="🔔" title="All quiet" body="Nothing new. That's a good thing." />
      ) : (
        <ul className="space-y-2">
          {list.map((n) => (
            <li key={n.id}>
              <Link
                to={n.link || "/home"}
                className={cn(
                  "card-soft flex gap-3 p-4 transition-colors hover:bg-muted",
                  !n.read_at && "border-l-4 border-l-coral",
                )}
              >
                <span className="text-2xl" aria-hidden="true">
                  {icon[n.kind] ?? "🔔"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{n.title}</span>
                  {n.body && (
                    <span className="block truncate text-sm text-muted-foreground">{n.body}</span>
                  )}
                </span>
                <span className="shrink-0 text-xs font-bold text-muted-foreground">
                  {timeAgo(n.created_at)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
