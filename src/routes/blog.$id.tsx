import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PublicLayout } from "@/components/public-layout";
import { EmptyState, Skeleton } from "@/components/kit";
import { api } from "@/lib/api";
import { topicLabel } from "./blog.index";

export const Route = createFileRoute("/blog/$id")({
  head: () => ({ meta: [{ title: "Community blog — Pause." }] }),
  component: BlogPost,
});

function BlogPost() {
  const { id } = Route.useParams();
  const q = useQuery({
    queryKey: ["blog-post", id],
    queryFn: () => api(`/blog/${id}`),
    retry: false,
  });
  const [hearted, setHearted] = useState(false);
  const p = q.data?.post;
  return (
    <PublicLayout>
      <article className="mx-auto max-w-2xl px-5 py-14">
        <Link to="/blog" className="text-sm font-bold text-muted-foreground underline">
          ← All stories
        </Link>
        {q.isLoading ? (
          <Skeleton className="mt-6 h-96" />
        ) : !p ? (
          <div className="mt-6">
            <EmptyState
              emoji="🍂"
              title="This piece isn't available"
              body="It may still be waiting for review, or it was taken down."
            />
          </div>
        ) : (
          <>
            <p className="mt-6 text-sm font-black text-forest uppercase">
              {topicLabel[p.topic] ?? p.topic}
            </p>
            <h1 className="mt-2 font-display text-4xl leading-tight font-black sm:text-5xl">
              {p.title}
            </h1>
            <p className="mt-3 text-sm font-bold text-muted-foreground">
              {p.pen_name} ·{" "}
              {new Date(p.published_at).toLocaleDateString(undefined, { dateStyle: "long" })}
            </p>
            <div className="mt-8 space-y-5 text-lg leading-relaxed">
              {String(p.body)
                .split(/\n{2,}/)
                .map((para: string, i: number) => (
                  <p key={i} className="whitespace-pre-line">
                    {para}
                  </p>
                ))}
            </div>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <button
                disabled={hearted}
                onClick={() => {
                  setHearted(true);
                  void api(`/blog/${id}/heart`, { method: "POST" }).catch(() => {});
                }}
                className="rounded-full border-2 border-ink bg-blush px-5 py-2.5 font-bold disabled:opacity-70"
              >
                💛 {hearted ? "Sent — thank you" : `This helped me (${p.hearts})`}
              </button>
              <Link
                to="/blog/write"
                className="rounded-full border-2 border-ink bg-card px-5 py-2.5 font-bold"
              >
                Share your own
              </Link>
            </div>
            <p className="mt-10 rounded-2xl bg-muted p-4 text-xs text-muted-foreground">
              Stories are personal experiences, not professional advice. If something here brings up
              a lot for you, you can talk to Pip, try a breathing exercise, or reach a helpline —
              Tele-MANAS 14416 (India), 988 (US), 116 123 (UK).
            </p>
          </>
        )}
      </article>
    </PublicLayout>
  );
}
