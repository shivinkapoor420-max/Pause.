import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Flag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PillButton } from "@/components/app-shell";
import { PostCard, ReportDialog } from "@/components/community";
import { Avatar, EmptyState, LoadingCards } from "@/components/kit";
import { api, timeAgo } from "@/lib/api";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/community/post/$id")({
  head: () => ({ meta: [{ title: "Post — Pause." }] }),
  component: PostPage,
});

function PostPage() {
  const { id } = Route.useParams();
  const { user } = useSession();
  const navigate = useNavigate();
  const q = useQuery({
    queryKey: ["post", id],
    queryFn: () => api(`/community/posts/${id}`),
    retry: false,
    enabled: user?.ageGroup === "adult",
  });
  const [reply, setReply] = useState("");
  const [replyTo, setReplyTo] = useState<any>(null);
  const [report, setReport] = useState<string | null>(null);
  const comments: any[] = q.data?.comments ?? [];
  const roots = comments.filter((c) => !c.parent_id);
  const children = (pid: string) => comments.filter((c) => c.parent_id === pid);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const r = await api<{ status: string }>(`/community/posts/${id}/comments`, {
        body: { body: reply, parentId: replyTo?.id ?? null },
      });
      setReply("");
      setReplyTo(null);
      if (r.status === "pending") toast.message("Your reply will appear after a quick review.");
      void q.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't reply");
    }
  };

  const Comment = ({ c, depth }: { c: any; depth: number }) => (
    <li className={depth ? "ml-8 border-l-2 border-border pl-4" : ""}>
      <div className="flex gap-3 py-3">
        <Link
          to="/u/$handle"
          params={{ handle: c.author_username }}
          aria-label={`${c.author_name}\'s profile`}
        >
          <Avatar style={c.author_style} imageId={c.author_avatar} size={34} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            <Link
              to="/u/$handle"
              params={{ handle: c.author_username }}
              className="font-bold hover:underline"
            >
              {c.author_name}
            </Link>{" "}
            <span className="text-xs text-muted-foreground">{timeAgo(c.created_at)}</span>
          </p>
          <p className="mt-0.5 whitespace-pre-wrap">{c.body}</p>
          <div className="mt-1 flex gap-3 text-xs font-bold text-muted-foreground">
            {depth < 2 && (
              <button onClick={() => setReplyTo(c)} className="hover:text-foreground">
                Reply
              </button>
            )}
            {c.mine ? (
              <button
                onClick={async () => {
                  await api(`/community/comments/${c.id}`, { method: "DELETE" });
                  void q.refetch();
                }}
                className="flex items-center gap-1 hover:text-destructive"
              >
                <Trash2 className="size-3" /> Delete
              </button>
            ) : (
              <button
                onClick={() => setReport(c.id)}
                className="flex items-center gap-1 hover:text-foreground"
              >
                <Flag className="size-3" /> Report
              </button>
            )}
          </div>
        </div>
      </div>
      {children(c.id).length > 0 && (
        <ul>
          {children(c.id).map((ch) => (
            <Comment key={ch.id} c={ch} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );

  return (
    <AppShell title="Post">
      <button
        onClick={() =>
          window.history.length > 1 ? window.history.back() : navigate({ to: "/community" })
        }
        className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-muted-foreground"
      >
        <ArrowLeft className="size-4" /> Back
      </button>
      {q.isLoading ? (
        <LoadingCards n={2} />
      ) : q.error || !q.data ? (
        <EmptyState
          emoji="🍂"
          title="This post isn't available"
          body="It may have been removed, or it's from someone you can't see."
        />
      ) : (
        <>
          <PostCard post={q.data.post} full onChanged={() => void q.refetch()} />
          <section className="card-soft mt-4 p-5" aria-label="Replies">
            <form onSubmit={send}>
              {replyTo && (
                <p className="mb-2 text-sm">
                  Replying to <strong>{replyTo.author_name}</strong>{" "}
                  <button type="button" onClick={() => setReplyTo(null)} className="underline">
                    cancel
                  </button>
                </p>
              )}
              <div className="flex gap-2">
                <Avatar style={user?.avatarStyle} size={36} />
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  maxLength={2000}
                  rows={2}
                  placeholder="Write something kind…"
                  className="flex-1 resize-none rounded-2xl bg-muted px-4 py-2.5 font-semibold outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="mt-2 flex justify-end">
                <PillButton
                  type="submit"
                  variant="forest"
                  className="min-h-10 px-5 py-2"
                  disabled={!reply.trim()}
                >
                  Reply
                </PillButton>
              </div>
            </form>
            <ul className="mt-2 divide-y divide-border">
              {roots.length === 0 ? (
                <li className="py-6 text-center text-sm text-muted-foreground">
                  No replies yet. Your kindness could be the first.
                </li>
              ) : (
                roots.map((c) => <Comment key={c.id} c={c} depth={0} />)
              )}
            </ul>
          </section>
        </>
      )}
      {report && <ReportDialog kind="comment" id={report} onClose={() => setReport(null)} />}
    </AppShell>
  );
}
