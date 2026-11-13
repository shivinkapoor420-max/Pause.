import { Link, createFileRoute } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { AppShell, PillButton } from "@/components/app-shell";
import { Composer, PostCard } from "@/components/community";
import { Avatar, Card, EmptyState, LoadingCards, Tabs } from "@/components/kit";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/community/")({
  head: () => ({ meta: [{ title: "Community — Pause." }] }),
  component: CommunityHome,
});

type Tab = "for-you" | "recent" | "following" | "trending" | "saved";

function CommunityHome() {
  const { user } = useSession();
  const [tab, setTab] = useState<Tab>("for-you");
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  const adult = user?.ageGroup === "adult" && !user.childMode;
  const feed = useInfiniteQuery({
    queryKey: ["feed", tab],
    queryFn: ({ pageParam }) =>
      api(
        `/community/feed?tab=${tab}${pageParam ? `&before=${encodeURIComponent(pageParam)}` : ""}`,
      ),
    initialPageParam: "",
    getNextPageParam: (last: any) =>
      last.posts.length === 20 && tab !== "trending"
        ? last.posts[last.posts.length - 1].created_at
        : undefined,
    enabled: adult,
  });
  const communities = useQuery({
    queryKey: ["communities"],
    queryFn: () => api("/community/communities"),
    enabled: adult,
  });
  const discover = useQuery({
    queryKey: ["discover"],
    queryFn: () => api("/community/discover"),
    enabled: adult,
  });
  const search = useQuery({
    queryKey: ["search", debounced],
    queryFn: () => api(`/community/search?q=${encodeURIComponent(debounced)}`),
    enabled: adult && debounced.length >= 2,
  });

  if (user && !adult) {
    return (
      <AppShell title="Community">
        <EmptyState
          emoji="🌱"
          title="The community is for adults"
          body="It's a space for grown-ups only. Your journal, Pip and games are all here for you."
        />
      </AppShell>
    );
  }
  const posts = feed.data?.pages.flatMap((p: any) => p.posts) ?? [];
  const refetch = () => void feed.refetch();

  return (
    <AppShell title="Community" wide>
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-black tracking-wide text-forest uppercase">
                Pause Community · 18+ · anonymous
              </p>
              <h1 className="font-display text-4xl font-black">Community</h1>
            </div>
            <Link to="/community/guidelines" className="text-sm font-bold underline">
              Guidelines
            </Link>
          </div>
          <label className="relative mb-4 block">
            <Search className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search posts, people and communities"
              className="w-full rounded-full border-2 border-border bg-card py-3 pr-4 pl-12 font-semibold outline-none focus:border-ring"
            />
          </label>
          {debounced.length >= 2 ? (
            <SearchResults data={search.data} loading={search.isLoading} onChanged={refetch} />
          ) : (
            <>
              <Composer
                communities={communities.data?.communities ?? []}
                prompt={discover.data?.prompt}
                onPosted={refetch}
              />
              <Tabs
                className="my-5"
                value={tab}
                onChange={setTab}
                items={[
                  { id: "for-you", label: "For you" },
                  { id: "recent", label: "Recent" },
                  { id: "following", label: "Following" },
                  { id: "trending", label: "Trending" },
                  { id: "saved", label: "Saved" },
                ]}
              />
              {feed.isLoading ? (
                <LoadingCards n={3} />
              ) : posts.length === 0 ? (
                <EmptyState
                  emoji="🌾"
                  title={
                    tab === "following"
                      ? "Follow people to see their posts here"
                      : tab === "saved"
                        ? "Nothing saved yet"
                        : "It's quiet here"
                  }
                  body={
                    tab === "for-you"
                      ? "Join a community or be the first to share something today."
                      : undefined
                  }
                />
              ) : (
                <div className="space-y-4">
                  {posts.map((p: any) => (
                    <PostCard key={p.id} post={p} onChanged={refetch} />
                  ))}
                  {feed.hasNextPage && (
                    <PillButton
                      variant="outline"
                      className="w-full"
                      onClick={() => void feed.fetchNextPage()}
                      disabled={feed.isFetchingNextPage}
                    >
                      {feed.isFetchingNextPage ? "Loading…" : "Load more"}
                    </PillButton>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <aside className="space-y-5">
          <Card className="bg-lavender/50">
            <p className="text-xs font-black text-forest uppercase">Today's prompt</p>
            <p className="mt-1 font-display text-lg font-bold">{discover.data?.prompt ?? "…"}</p>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Communities</h2>
              <Link to="/community/communities" className="text-sm font-bold underline">
                All
              </Link>
            </div>
            <ul className="mt-3 space-y-2">
              {(communities.data?.communities ?? []).slice(0, 6).map((c: any) => (
                <li key={c.id}>
                  <Link
                    to="/community/c/$slug"
                    params={{ slug: c.slug }}
                    className="flex items-center gap-3 rounded-2xl p-1.5 hover:bg-muted"
                  >
                    <span
                      className="size-9 shrink-0 rounded-xl"
                      style={{
                        background: `linear-gradient(135deg, oklch(0.85 0.1 ${c.cover_hue}), oklch(0.7 0.13 ${c.cover_hue + 40}))`,
                      }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{c.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {c.members} members {c.my_role && "· joined"}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          {(discover.data?.trending ?? []).length > 0 && (
            <Card>
              <h2 className="font-display text-lg font-bold">Trending</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {discover.data.trending.map((t: any) => (
                  <button
                    key={t.tag}
                    onClick={() => setQ(t.tag)}
                    className="rounded-full bg-muted px-3 py-1 text-sm font-bold"
                  >
                    #{t.tag}
                  </button>
                ))}
              </div>
            </Card>
          )}
          {(discover.data?.suggested ?? []).length > 0 && (
            <Card>
              <h2 className="font-display text-lg font-bold">People you might like</h2>
              <ul className="mt-3 space-y-2">
                {discover.data.suggested.map((u: any) => (
                  <li key={u.id}>
                    <Link
                      to="/u/$handle"
                      params={{ handle: u.username }}
                      className="flex items-center gap-3 rounded-2xl p-1.5 hover:bg-muted"
                    >
                      <Avatar style={u.avatar_style} imageId={u.avatar_id} size={36} />
                      <span className="truncate text-sm font-bold">{u.display_name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <p className="px-2 text-xs text-muted-foreground">
            Peer support, not professional advice. In crisis? Tele-MANAS 14416 · 988 (US) · 116 123
            (UK).
          </p>
        </aside>
      </div>
    </AppShell>
  );
}

function SearchResults({
  data,
  loading,
  onChanged,
}: {
  data: any;
  loading: boolean;
  onChanged: () => void;
}) {
  if (loading || !data) return <LoadingCards n={2} />;
  const empty = !data.users.length && !data.posts.length && !data.communities.length;
  if (empty) return <EmptyState emoji="🔍" title="No results" />;
  return (
    <div className="space-y-5">
      {data.communities.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.communities.map((c: any) => (
            <Link
              key={c.slug}
              to="/community/c/$slug"
              params={{ slug: c.slug }}
              className="rounded-full border-2 border-ink bg-card px-4 py-2 text-sm font-bold"
            >
              {c.name}
            </Link>
          ))}
        </div>
      )}
      {data.users.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.users.map((u: any) => (
            <Link
              key={u.id}
              to="/u/$handle"
              params={{ handle: u.username }}
              className="flex items-center gap-2 rounded-full bg-card py-1 pr-4 pl-1 text-sm font-bold"
            >
              <Avatar style={u.avatar_style} imageId={u.avatar_id} size={30} /> {u.display_name}
            </Link>
          ))}
        </div>
      )}
      {data.posts.map((p: any) => (
        <PostCard key={p.id} post={p} onChanged={onChanged} />
      ))}
    </div>
  );
}
