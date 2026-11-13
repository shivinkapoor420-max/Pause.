import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Lock, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PillButton } from "@/components/app-shell";
import { PostCard, ReportDialog } from "@/components/community";
import { Avatar, Card, EmptyState, LoadingCards } from "@/components/kit";
import { api, mediaUrl } from "@/lib/api";

export const Route = createFileRoute("/u/$handle")({
  head: () => ({ meta: [{ title: "Profile — Pause." }] }),
  component: Profile,
});

const achievementEmoji: Record<string, string> = {
  first_checkin: "🌱",
  checkin_7: "🌤️",
  checkin_30: "🌳",
  first_journal: "📓",
  journal_10: "📚",
  first_breath: "🫧",
  breath_10: "🌬️",
  first_game: "🎮",
  games_5_kinds: "🧭",
  games_25: "⭐",
  first_post: "💬",
  helper: "🤝",
  garden_20: "🌷",
  premium_supporter: "💛",
};

function Profile() {
  const { handle } = Route.useParams();
  const navigate = useNavigate();
  const q = useQuery({
    queryKey: ["profile", handle],
    queryFn: () => api(`/community/u/${handle}`),
    retry: false,
  });
  const [report, setReport] = useState(false);
  const p = q.data?.profile;

  const follow = async () => {
    try {
      await api(`/community/users/${p.id}/follow`, { method: "POST" });
      void q.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't follow");
    }
  };
  const message = async () => {
    try {
      const r = await api<{ id: string }>("/messages/conversations", {
        body: { handles: [p.username] },
      });
      navigate({ to: "/messages/$id", params: { id: r.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start a conversation");
    }
  };
  const block = async () => {
    if (
      !p.rel.blocked &&
      !confirm(`Block ${p.displayName}? They won't be able to see your posts or message you.`)
    )
      return;
    await api(`/community/users/${p.id}/block`, { method: "POST" });
    void q.refetch();
  };

  return (
    <AppShell title="Profile" wide>
      {q.isLoading ? (
        <LoadingCards n={2} />
      ) : !p ? (
        <EmptyState emoji="🫥" title="Profile not found" />
      ) : (
        <>
          <div className="overflow-hidden rounded-3xl border-2 border-ink bg-card">
            <div
              className="h-36 bg-gradient-to-br from-primary via-lavender to-blush sm:h-48"
              style={
                p.coverId
                  ? { backgroundImage: `url(${mediaUrl(p.coverId)})`, backgroundSize: "cover" }
                  : undefined
              }
            />
            <div className="px-5 pb-5 sm:px-8">
              <div className="-mt-12 flex flex-wrap items-end justify-between gap-3">
                <Avatar
                  style={p.avatarStyle}
                  imageId={p.avatarId}
                  size={96}
                  className="rounded-full border-4 border-card"
                  online={p.online}
                />
                <div className="flex flex-wrap gap-2">
                  {p.isMe ? (
                    <Link to="/settings">
                      <PillButton variant="outline">Edit profile</PillButton>
                    </Link>
                  ) : (
                    <>
                      {!p.rel.blocked && (
                        <PillButton
                          variant={p.rel.following ? "outline" : "forest"}
                          onClick={() => void follow()}
                        >
                          {p.rel.following
                            ? "Following"
                            : p.rel.follows_me
                              ? "Follow back"
                              : "Follow"}
                        </PillButton>
                      )}
                      {!p.rel.blocked && (
                        <PillButton variant="outline" onClick={() => void message()}>
                          <MessageCircle className="size-4" /> Message
                        </PillButton>
                      )}
                      <PillButton variant="ghost" onClick={() => void block()}>
                        {p.rel.blocked ? "Unblock" : "Block"}
                      </PillButton>
                      <PillButton variant="ghost" onClick={() => setReport(true)}>
                        Report
                      </PillButton>
                    </>
                  )}
                </div>
              </div>
              <h1 className="mt-3 font-display text-3xl font-black">{p.displayName}</h1>
              <p className="text-sm text-muted-foreground">
                @{p.username}{" "}
                {p.joined &&
                  `· joined ${new Date(p.joined).toLocaleDateString(undefined, { month: "long", year: "numeric" })}`}
              </p>
              {p.bio && <p className="mt-3 max-w-2xl">{p.bio}</p>}
              <div className="mt-3 flex gap-5 text-sm">
                <span>
                  <strong>{p.counts.posts}</strong> posts
                </span>
                <span>
                  <strong>{p.counts.followers}</strong> followers
                </span>
                <span>
                  <strong>{p.counts.following}</strong> following
                </span>
              </div>
              {p.interests?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.interests.map((i: string) => (
                    <span key={i} className="rounded-full bg-lavender px-3 py-1 text-xs font-bold">
                      {i}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {!p.canSee ? (
            <div className="mt-6">
              <EmptyState
                emoji="🔒"
                title="This profile is private"
                body={p.visibility === "followers" ? "Follow to see their posts." : undefined}
              />
            </div>
          ) : (
            <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
              <div className="space-y-4">
                {(q.data.posts ?? []).length === 0 ? (
                  <EmptyState emoji="🌾" title="No posts yet" />
                ) : (
                  q.data.posts.map((post: any) => (
                    <PostCard key={post.id} post={post} onChanged={() => void q.refetch()} />
                  ))
                )}
              </div>
              <aside className="space-y-5">
                <Card>
                  <h2 className="font-display text-lg font-bold">Garden</h2>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-center text-sm">
                    <div className="rounded-2xl bg-muted p-3">
                      <p className="font-display text-2xl font-black">{p.garden.checkins}</p>
                      check-ins
                    </div>
                    <div className="rounded-2xl bg-muted p-3">
                      <p className="font-display text-2xl font-black">{p.garden.activities}</p>calm
                      moments
                    </div>
                  </div>
                </Card>
                {p.achievements.length > 0 && (
                  <Card>
                    <h2 className="font-display text-lg font-bold">Achievements</h2>
                    <div className="mt-2 flex flex-wrap gap-2 text-3xl">
                      {p.achievements.map((a: any) => (
                        <span key={a.key} title={a.key}>
                          {achievementEmoji[a.key] ?? "🏅"}
                        </span>
                      ))}
                    </div>
                  </Card>
                )}
                {p.communities.length > 0 && (
                  <Card>
                    <h2 className="font-display text-lg font-bold">Communities</h2>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {p.communities.map((c: any) => (
                        <Link
                          key={c.slug}
                          to="/community/c/$slug"
                          params={{ slug: c.slug }}
                          className="rounded-full bg-muted px-3 py-1 text-xs font-bold"
                        >
                          {c.name}
                        </Link>
                      ))}
                    </div>
                  </Card>
                )}
              </aside>
            </div>
          )}
          {p.visibility === "private" && p.isMe && (
            <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="size-4" /> Your profile is private — only you can see this.
            </p>
          )}
        </>
      )}
      {report && p && <ReportDialog kind="user" id={p.id} onClose={() => setReport(false)} />}
    </AppShell>
  );
}
