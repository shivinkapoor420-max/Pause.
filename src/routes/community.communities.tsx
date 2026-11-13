import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Lock, Plus } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PillButton } from "@/components/app-shell";
import { Badge, Card, Field, LoadingCards, PageHeader, inputCls } from "@/components/kit";
import { api } from "@/lib/api";

export const Route = createFileRoute("/community/communities")({
  head: () => ({ meta: [{ title: "Communities — Pause." }] }),
  component: Communities,
});

function Communities() {
  const q = useQuery({ queryKey: ["communities"], queryFn: () => api("/community/communities") });
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [f, setF] = useState({ name: "", description: "", guidelines: "", hue: 150 });
  return (
    <AppShell title="Communities" wide>
      <PageHeader
        title="Communities"
        subtitle="Small, kind circles around the things you're working through."
        action={
          <PillButton variant="coral" onClick={() => setCreating(!creating)}>
            <Plus className="size-5" /> Create
          </PillButton>
        }
      />
      {creating && (
        <Card className="mb-6">
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const r = await api<{ slug: string }>("/community/communities", { body: f });
                toast.success("Community created — you're the owner");
                navigate({ to: "/community/c/$slug", params: { slug: r.slug } });
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Couldn't create");
              }
            }}
          >
            <Field label="Name">
              <input
                required
                minLength={3}
                maxLength={60}
                value={f.name}
                onChange={(e) => setF({ ...f, name: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Colour">
              <input
                type="range"
                min={0}
                max={360}
                value={f.hue}
                onChange={(e) => setF({ ...f, hue: Number(e.target.value) })}
                className="w-full"
                style={{ accentColor: `oklch(0.7 0.13 ${f.hue})` }}
              />
            </Field>
            <Field label="What's it about?">
              <textarea
                required
                minLength={10}
                maxLength={400}
                rows={3}
                value={f.description}
                onChange={(e) => setF({ ...f, description: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Extra guidelines (optional)">
              <textarea
                maxLength={2000}
                rows={3}
                value={f.guidelines}
                onChange={(e) => setF({ ...f, guidelines: e.target.value })}
                className={inputCls}
              />
            </Field>
            <PillButton type="submit" variant="forest" className="w-fit">
              Create community
            </PillButton>
          </form>
        </Card>
      )}
      {q.isLoading ? (
        <LoadingCards n={3} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {q.data.communities.map((c: any) => (
            <Link
              key={c.id}
              to="/community/c/$slug"
              params={{ slug: c.slug }}
              className="lift overflow-hidden rounded-3xl border-2 border-ink bg-card"
            >
              <div
                className="h-20"
                style={{
                  background: `linear-gradient(135deg, oklch(0.88 0.09 ${c.cover_hue}), oklch(0.72 0.13 ${c.cover_hue + 50}))`,
                }}
              />
              <div className="p-5">
                <h2 className="font-display text-xl font-bold">
                  {c.name}{" "}
                  {c.premium &&
                    (q.data.premium ? (
                      <Badge tone="premium">Premium</Badge>
                    ) : (
                      <Lock className="inline size-4" />
                    ))}
                </h2>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>
                <p className="mt-3 text-xs font-bold text-forest">
                  {c.members} members · {c.posts_week} posts this week {c.my_role && "· joined"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
