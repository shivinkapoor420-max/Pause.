import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, PillButton } from "@/components/app-shell";
import { EmptyState, PageHeader } from "@/components/kit";
import { api } from "@/lib/api";

export const Route = createFileRoute("/settings/blocked")({
  head: () => ({ meta: [{ title: "Blocked members — Pause." }] }),
  component: Blocked,
});

function Blocked() {
  const q = useQuery({ queryKey: ["blocked"], queryFn: () => api("/community/blocked") });
  const list: any[] = q.data?.users ?? [];
  return (
    <AppShell title="Blocked members">
      <PageHeader
        title="Blocked & muted"
        subtitle="Blocked members can't see your posts or message you. Muted members' posts are hidden from your feed — they aren't told."
      />
      {list.length === 0 ? (
        <EmptyState emoji="🕊️" title="Nobody here" />
      ) : (
        <ul className="space-y-2">
          {list.map((u) => (
            <li
              key={`${u.kind}${u.id}`}
              className="card-soft flex items-center justify-between p-4"
            >
              <span className="font-bold">
                {u.display_name}{" "}
                <span className="text-xs text-muted-foreground">
                  ({u.kind === "block" ? "blocked" : "muted"})
                </span>
              </span>
              <PillButton
                variant="outline"
                onClick={() =>
                  void api(`/community/users/${u.id}/${u.kind}`, { method: "POST" }).then(() =>
                    q.refetch(),
                  )
                }
              >
                {u.kind === "block" ? "Unblock" : "Unmute"}
              </PillButton>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
