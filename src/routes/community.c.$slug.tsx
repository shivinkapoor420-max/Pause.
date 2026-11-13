import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PillButton } from "@/components/app-shell";
import { Composer, PostCard, ReportDialog } from "@/components/community";
import { Card, EmptyState, LoadingCards } from "@/components/kit";
import { api } from "@/lib/api";

export const Route = createFileRoute("/community/c/$slug")({
  head: () => ({ meta: [{ title: "Community — Pause." }] }),
  component: CommunityPage,
});

function CommunityPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const c = useQuery({
    queryKey: ["community", slug],
    queryFn: () => api(`/community/c/${slug}`),
    retry: false,
  });
  const feed = useQuery({
    queryKey: ["feed", "c", slug],
    queryFn: () => api(`/community/feed?community=${slug}`),
    enabled: !!c.data && !c.data.community.locked,
  });
  const all = useQuery({ queryKey: ["communities"], queryFn: () => api("/community/communities") });
  const [report, setReport] = useState(false);
  const com = c.data?.community;
  const join = async (leave = false) => {
    try {
      await api(`/community/c/${slug}/${leave ? "leave" : "join"}`, { method: "POST" });
      await Promise.all([c.refetch(), all.refetch()]);
      toast.success(leave ? "You left the community" : `Welcome to ${com.name} 🌿`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't join");
    }
  };
  return (
    <AppShell title={com?.name ?? "Community"} wide>
      {c.isLoading ? (
        <LoadingCards n={2} />
      ) : !com ? (
        <EmptyState
          emoji="🌫️"
          title="Community not found"
          action={
            <Link to="/community" className="font-bold underline">
              Back to community
            </Link>
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="min-w-0">
            <div
              className="relative overflow-hidden rounded-3xl border-2 border-ink p-6 sm:p-8"
              style={{
                background: `linear-gradient(135deg, oklch(0.88 0.09 ${com.cover_hue}), oklch(0.72 0.13 ${com.cover_hue + 50}))`,
              }}
            >
              <h1 className="font-display text-4xl font-black">{com.name}</h1>
              <p className="mt-2 max-w-xl font-semibold">{com.description}</p>
              <p className="mt-3 text-sm font-bold">{com.members} members</p>
              <div className="mt-4 flex gap-2">
                {com.my_role && !com.locked && (
                  <PillButton
                    variant="outline"
                    onClick={async () => {
                      try {
                        const r = await api<{ id: string }>(`/community/c/${slug}/chat`, {
                          method: "POST",
                        });
                        navigate({ to: "/messages/$id", params: { id: r.id } });
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Couldn't open the chat");
                      }
                    }}
                  >
                    💬 Group chat
                  </PillButton>
                )}
                {com.locked ? (
                  <Link to="/pricing">
                    <PillButton variant="outline">
                      <Lock className="size-4" /> Premium community
                    </PillButton>
                  </Link>
                ) : com.my_role ? (
                  com.my_role !== "owner" && (
                    <PillButton variant="outline" onClick={() => void join(true)}>
                      Joined ✓ · Leave
                    </PillButton>
                  )
                ) : (
                  <PillButton variant="forest" onClick={() => void join()}>
                    Join
                  </PillButton>
                )}
              </div>
            </div>
            {!com.locked && (
              <div className="mt-5 space-y-4">
                {com.my_role && (
                  <Composer
                    communities={all.data?.communities ?? []}
                    defaultCommunityId={com.id}
                    onPosted={() => void feed.refetch()}
                  />
                )}
                {feed.isLoading ? (
                  <LoadingCards n={2} />
                ) : (feed.data?.posts ?? []).length === 0 ? (
                  <EmptyState
                    emoji="🌱"
                    title="No posts yet"
                    body={
                      com.my_role ? "Start the conversation." : "Join to start the conversation."
                    }
                  />
                ) : (
                  feed.data.posts.map((p: any) => (
                    <PostCard key={p.id} post={p} onChanged={() => void feed.refetch()} />
                  ))
                )}
              </div>
            )}
          </div>
          <aside className="space-y-5">
            <Card>
              <h2 className="font-display text-lg font-bold">Guidelines</h2>
              <p className="mt-2 text-sm whitespace-pre-line text-muted-foreground">
                {com.guidelines}
              </p>
            </Card>
            {(c.data.moderators ?? []).length > 0 && (
              <Card>
                <h2 className="font-display text-lg font-bold">Moderators</h2>
                <ul className="mt-2 space-y-1 text-sm font-bold">
                  {c.data.moderators.map((m: any) => (
                    <li key={m.username}>
                      <Link
                        to="/u/$handle"
                        params={{ handle: m.username }}
                        className="hover:underline"
                      >
                        {m.display_name}
                      </Link>{" "}
                      <span className="text-xs text-muted-foreground">{m.role}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            <button
              onClick={() => setReport(true)}
              className="px-2 text-sm font-bold text-muted-foreground underline"
            >
              Report this community
            </button>
          </aside>
        </div>
      )}
      {report && com && (
        <ReportDialog kind="community" id={com.id} onClose={() => setReport(false)} />
      )}
    </AppShell>
  );
}
