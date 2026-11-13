import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { BellOff, Plus } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PillButton } from "@/components/app-shell";
import { Avatar, Badge, EmptyState, LoadingCards, PageHeader, inputCls } from "@/components/kit";
import { api, timeAgo } from "@/lib/api";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/messages/")({
  head: () => ({ meta: [{ title: "Messages — Pause." }] }),
  component: Inbox,
});

function Inbox() {
  const { user } = useSession();
  const navigate = useNavigate();
  const adult = user?.ageGroup === "adult" && !user.childMode;
  const q = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api("/messages/conversations"),
    enabled: adult,
  });
  const [composing, setComposing] = useState(false);
  const [handles, setHandles] = useState("");
  const [title, setTitle] = useState("");
  const list: any[] = q.data?.conversations ?? [];
  const requests = list.filter((c) => c.status === "pending");
  const chats = list.filter((c) => c.status !== "pending");

  if (user && !adult) {
    return (
      <AppShell title="Messages">
        <EmptyState
          emoji="🌱"
          title="Messaging is for adults"
          body="Pip is always here to listen, though."
          action={
            <Link to="/companion" className="font-bold underline">
              Talk to Pip
            </Link>
          }
        />
      </AppShell>
    );
  }

  const Row = ({ c }: { c: any }) => {
    const names = (c.members ?? []).map((m: any) => m.name).join(", ") || "Just you";
    const first = c.members?.[0];
    return (
      <li>
        <Link
          to="/messages/$id"
          params={{ id: c.id }}
          className={cn(
            "flex items-center gap-3 rounded-2xl p-3 transition-colors hover:bg-muted",
            c.unread && "bg-primary/30",
          )}
        >
          {c.is_group ? (
            <span
              className="grid size-12 place-items-center rounded-full bg-lavender text-xl"
              aria-hidden="true"
            >
              👥
            </span>
          ) : (
            <Avatar style={first?.style} size={48} online={first?.online} />
          )}
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className={cn("truncate", c.unread ? "font-black" : "font-bold")}>
                {c.is_group && c.title ? c.title : names}
              </span>
              {c.muted && <BellOff className="size-3.5 text-muted-foreground" />}
            </span>
            <span className="block truncate text-sm text-muted-foreground">
              {c.last
                ? `${c.last.sender === user?.id ? "You: " : ""}${c.last.body}`
                : "No messages yet"}
            </span>
          </span>
          <span className="shrink-0 text-xs font-bold text-muted-foreground">
            {timeAgo(c.last?.at ?? c.last_message_at)}
          </span>
        </Link>
      </li>
    );
  };

  return (
    <AppShell title="Messages">
      <PageHeader
        title="Messages"
        subtitle="Private conversations with other members, under your pseudonyms."
        action={
          <PillButton variant="coral" onClick={() => setComposing(!composing)}>
            <Plus className="size-5" /> New
          </PillButton>
        }
      />
      {composing && (
        <form
          className="card-soft mb-5 space-y-3 p-5"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const list = handles
                .split(/[\s,]+/)
                .map((h) => h.replace(/^@/, ""))
                .filter(Boolean);
              const r = await api<{ id: string }>("/messages/conversations", {
                body: { handles: list, ...(title ? { title } : {}) },
              });
              navigate({ to: "/messages/$id", params: { id: r.id } });
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Couldn't start conversation");
            }
          }}
        >
          <input
            required
            value={handles}
            onChange={(e) => setHandles(e.target.value)}
            placeholder="Pseudonym(s), e.g. QuietFern_482 — separate several with commas for a group"
            className={inputCls}
          />
          {handles.includes(",") && (
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Group name (optional)"
              maxLength={60}
              className={inputCls}
            />
          )}
          <p className="text-xs text-muted-foreground">
            If they don't follow you yet, they'll get a message request first. Group chats are a
            Premium feature.
          </p>
          <PillButton type="submit" variant="forest">
            Start chatting
          </PillButton>
        </form>
      )}
      {q.isLoading ? (
        <LoadingCards n={3} />
      ) : list.length === 0 ? (
        <EmptyState
          emoji="💌"
          title="No conversations yet"
          body="Find someone in the community and say hello — kindly."
          action={
            <Link to="/community" className="font-bold underline">
              Go to community
            </Link>
          }
        />
      ) : (
        <>
          {requests.length > 0 && (
            <section className="mb-5">
              <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-bold">
                Message requests <Badge tone="coral">{requests.length}</Badge>
              </h2>
              <ul className="card-soft p-2">
                {requests.map((c) => (
                  <Row key={c.id} c={c} />
                ))}
              </ul>
            </section>
          )}
          <ul className="card-soft p-2">
            {chats.map((c) => (
              <Row key={c.id} c={c} />
            ))}
          </ul>
        </>
      )}
    </AppShell>
  );
}
