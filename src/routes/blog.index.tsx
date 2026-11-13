import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useState } from "react";
import { PenLine } from "lucide-react";
import { PublicLayout } from "@/components/public-layout";
import { EmptyState, LoadingCards } from "@/components/kit";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title: "Community blog — Pause." },
      {
        name: "description",
        content:
          "Real thoughts from real people — anonymous stories about recovery, ADHD, anxiety and hope, reviewed with care.",
      },
    ],
  }),
  component: Blog,
});

export const topicLabel: Record<string, string> = {
  thoughts: "Parked thoughts",
  recovery: "Recovery",
  adhd: "ADHD & restless minds",
  anxiety: "Anxiety",
  hope: "Hope",
  relationships: "Relationships",
  work: "Work & study",
  gratitude: "Gratitude",
};

function Blog() {
  const [topic, setTopic] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["blog", topic],
    queryFn: () => api(`/blog${topic ? `?topic=${topic}` : ""}`),
  });
  const posts: any[] = q.data?.posts ?? [];
  return (
    <PublicLayout>
      <div className="mx-auto max-w-5xl px-5 py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-black tracking-wide text-forest uppercase">Community blog</p>
            <h1 className="mt-2 font-display text-5xl font-black tracking-tight">
              Park a thought.
            </h1>
            <p className="mt-3 max-w-xl text-lg text-muted-foreground">
              Honest words from people finding their pause. Shared anonymously, read by a real
              person before they go up, and kept here for whoever needs them next.
            </p>
          </div>
          <Link
            to="/blog/write"
            className="inline-flex min-h-12 items-center gap-2 rounded-full border-2 border-ink bg-coral px-6 font-bold text-coral-foreground"
          >
            <PenLine className="size-5" /> Write something
          </Link>
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          {[null, ...Object.keys(topicLabel)].map((t) => (
            <button
              key={t ?? "all"}
              onClick={() => setTopic(t)}
              aria-pressed={topic === t}
              className={cn(
                "rounded-full border-2 px-4 py-2 text-sm font-bold",
                topic === t ? "border-ink bg-mustard" : "border-border bg-card",
              )}
            >
              {t ? topicLabel[t] : "All"}
            </button>
          ))}
        </div>

        <div className="mt-8">
          {q.isLoading ? (
            <LoadingCards n={3} />
          ) : posts.length === 0 ? (
            <EmptyState
              emoji="🪶"
              title="No stories here yet"
              body="Be the first to park a thought. It'll appear after a quick review."
              action={
                <Link to="/blog/write" className="font-bold underline">
                  Write the first one
                </Link>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {posts.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Link
                    to="/blog/$id"
                    params={{ id: p.id }}
                    className="card-soft lift block h-full p-6"
                  >
                    <p className="text-xs font-black text-forest uppercase">
                      {topicLabel[p.topic] ?? p.topic}
                    </p>
                    <h2 className="mt-2 font-display text-2xl leading-tight font-bold">
                      {p.title}
                    </h2>
                    <p className="mt-3 line-clamp-4 text-sm text-muted-foreground">{p.excerpt}</p>
                    <p className="mt-4 text-xs font-bold text-muted-foreground">
                      {p.pen_name} ·{" "}
                      {new Date(p.published_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}{" "}
                      · {p.minutes} min read · 💛 {p.hearts}
                    </p>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
