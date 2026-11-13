import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  BellOff,
  Bell,
  ImagePlus,
  Mic,
  MoreVertical,
  Reply,
  Send,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell, PillButton } from "@/components/app-shell";
import { ReportDialog } from "@/components/community";
import { Avatar, EmptyState, LoadingCards } from "@/components/kit";
import { api, mediaUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/messages/$id")({
  head: () => ({ meta: [{ title: "Conversation — Pause." }] }),
  component: Conversation,
});

const emojis = ["❤️", "🤗", "👍", "😂", "😮", "😢", "🙏"];

function Conversation() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const q = useQuery({
    queryKey: ["conversation", id],
    queryFn: () => api(`/messages/conversations/${id}`),
    retry: false,
  });
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<any>(null);
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState<{ kind: "message" | "user"; id: string } | null>(null);
  const [recording, setRecording] = useState<MediaRecorder | null>(null);
  const [picker, setPicker] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [typing, setTyping] = useState<string | null>(null);
  const lastTyping = useRef(0);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const on = (e: Event) => {
      const d = (e as CustomEvent).detail as { conversationId: string; name: string };
      if (d.conversationId !== id) return;
      setTyping(d.name);
      clearTimeout(t);
      t = setTimeout(() => setTyping(null), 4000);
    };
    window.addEventListener("pause:typing", on);
    return () => {
      window.removeEventListener("pause:typing", on);
      clearTimeout(t);
    };
  }, [id]);
  const fileRef = useRef<HTMLInputElement>(null);
  const data = q.data;
  const me = data?.me;
  const others = (data?.members ?? []).filter((m: any) => m.id !== me);
  const myStatus = (data?.members ?? []).find((m: any) => m.id === me)?.status;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
    if (data && myStatus === "accepted")
      void api(`/messages/conversations/${id}/read`, { method: "POST" }).catch(() => {});
  }, [data?.messages?.length, id, myStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async (body: Record<string, unknown>) => {
    try {
      await api(`/messages/conversations/${id}`, {
        body: { ...body, replyTo: replyTo?.id ?? null },
      });
      setReplyTo(null);
      void q.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send");
    }
  };
  const upload = async (blob: Blob, kind: "image" | "voice") => {
    try {
      const r = await api<{ id: string }>(`/media?scope=message&conversationId=${id}`, {
        raw: blob,
        headers: { "content-type": blob.type || "application/octet-stream" },
      });
      await send({ kind, mediaId: r.id, body: "" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    }
  };
  const toggleRecord = async () => {
    if (recording) {
      recording.stop();
      setRecording(null);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        void upload(new Blob(chunks, { type: rec.mimeType || "audio/webm" }), "voice");
      };
      rec.start();
      setRecording(rec);
      setTimeout(() => rec.state === "recording" && rec.stop(), 60000);
    } catch {
      toast.error("Microphone access is needed for voice notes.");
    }
  };

  if (q.isLoading)
    return (
      <AppShell title="Conversation">
        <LoadingCards n={3} />
      </AppShell>
    );
  if (!data)
    return (
      <AppShell title="Conversation">
        <EmptyState emoji="💬" title="Conversation not found" />
      </AppShell>
    );
  const title =
    data.conversation.is_group && data.conversation.title
      ? data.conversation.title
      : others.map((o: any) => o.name).join(", ");
  const otherRead = others
    .map((o: any) => o.last_read_at)
    .filter(Boolean)
    .sort()
    .pop();

  return (
    <AppShell title={title}>
      <div className="card-soft flex h-[calc(100dvh-11rem)] flex-col overflow-hidden p-0 lg:h-[calc(100dvh-8rem)]">
        <header className="flex items-center gap-3 border-b border-border p-3">
          <Link
            to="/messages"
            className="rounded-full p-2 hover:bg-muted"
            aria-label="Back to messages"
          >
            <ArrowLeft className="size-5" />
          </Link>
          {others[0] && <Avatar style={others[0].style} size={40} online={others[0].online} />}
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold">{title || "Conversation"}</p>
            <p className="text-xs text-muted-foreground">
              {others.some((o: any) => o.online)
                ? "Online"
                : data.conversation.is_group
                  ? `${others.length + 1} members`
                  : ""}
            </p>
          </div>
          <div className="relative">
            <button
              onClick={() => setMenu(!menu)}
              className="rounded-full p-2 hover:bg-muted"
              aria-label="Conversation options"
            >
              <MoreVertical className="size-5" />
            </button>
            {menu && (
              <div className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
                <button
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-bold hover:bg-muted"
                  onClick={() =>
                    void api(`/messages/conversations/${id}`, {
                      method: "PATCH",
                      body: { muted: !data.conversation.muted },
                    }).then(() => (setMenu(false), q.refetch()))
                  }
                >
                  {data.conversation.muted ? (
                    <Bell className="size-4" />
                  ) : (
                    <BellOff className="size-4" />
                  )}{" "}
                  {data.conversation.muted ? "Unmute" : "Mute"} notifications
                </button>
                {others[0] && (
                  <>
                    <Link
                      to="/u/$handle"
                      params={{ handle: others[0].handle }}
                      className="block px-4 py-2.5 text-sm font-bold hover:bg-muted"
                    >
                      View profile
                    </Link>
                    <button
                      className="block w-full px-4 py-2.5 text-left text-sm font-bold hover:bg-muted"
                      onClick={() => (
                        setReport({ kind: "user", id: others[0].id }),
                        setMenu(false)
                      )}
                    >
                      Report {others[0].name}
                    </button>
                    <button
                      className="block w-full px-4 py-2.5 text-left text-sm font-bold text-destructive hover:bg-muted"
                      onClick={() =>
                        confirm(`Block ${others[0].name}?`) &&
                        void api(`/community/users/${others[0].id}/block`, { method: "POST" }).then(
                          () => navigate({ to: "/messages" }),
                        )
                      }
                    >
                      Block
                    </button>
                  </>
                )}
                <button
                  className="block w-full px-4 py-2.5 text-left text-sm font-bold text-destructive hover:bg-muted"
                  onClick={() =>
                    confirm("Delete this conversation for you?") &&
                    void api(`/messages/conversations/${id}`, { method: "DELETE" }).then(() =>
                      navigate({ to: "/messages" }),
                    )
                  }
                >
                  Delete conversation
                </button>
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 space-y-2 overflow-y-auto p-4" aria-live="polite">
          {data.messages.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Say hello 👋 Be kind — everyone here is carrying something.
            </p>
          )}
          {data.messages.map((m: any) => {
            const mine = m.sender_id === me;
            const sender = data.members.find((x: any) => x.id === m.sender_id);
            const reacts = Object.values(m.reactions ?? {}) as string[];
            return (
              <div key={m.id} className={cn("group flex", mine ? "justify-end" : "justify-start")}>
                <div className={cn("relative max-w-[78%]")}>
                  {data.conversation.is_group && !mine && (
                    <p className="mb-0.5 ml-3 text-xs font-bold text-muted-foreground">
                      {sender?.name}
                    </p>
                  )}
                  <div
                    className={cn(
                      "rounded-3xl px-4 py-2.5",
                      mine
                        ? "rounded-br-md bg-forest text-forest-foreground"
                        : "rounded-bl-md bg-muted",
                      m.deleted && "italic opacity-60",
                    )}
                  >
                    {m.reply_body && (
                      <p className="mb-1 border-l-2 border-current pl-2 text-xs opacity-75">
                        {m.reply_body}
                      </p>
                    )}
                    {m.deleted ? (
                      "Message deleted"
                    ) : m.kind === "image" ? (
                      <img
                        src={mediaUrl(m.media_id)}
                        alt="Shared image"
                        className="max-h-64 rounded-2xl"
                      />
                    ) : m.kind === "voice" ? (
                      <audio controls src={mediaUrl(m.media_id)} className="max-w-full" />
                    ) : (
                      <p className="whitespace-pre-wrap">{m.body}</p>
                    )}
                  </div>
                  {reacts.length > 0 && (
                    <span
                      className={cn(
                        "absolute -bottom-3 rounded-full border border-border bg-card px-1.5 text-sm",
                        mine ? "left-2" : "right-2",
                      )}
                    >
                      {[...new Set(reacts)].join("")}
                    </span>
                  )}
                  {!m.deleted && (
                    <div
                      className={cn(
                        "absolute top-1 hidden gap-0.5 group-hover:flex group-focus-within:flex",
                        mine ? "-left-24" : "-right-24",
                      )}
                    >
                      <button
                        className="rounded-full bg-card p-1.5 shadow"
                        aria-label="React"
                        onClick={() => setPicker(picker === m.id ? null : m.id)}
                      >
                        🙂
                      </button>
                      <button
                        className="rounded-full bg-card p-1.5 shadow"
                        aria-label="Reply"
                        onClick={() => setReplyTo(m)}
                      >
                        <Reply className="size-4" />
                      </button>
                      {mine ? (
                        <button
                          className="rounded-full bg-card p-1.5 shadow"
                          aria-label="Delete message"
                          onClick={() =>
                            void api(`/messages/${m.id}`, { method: "DELETE" }).then(() =>
                              q.refetch(),
                            )
                          }
                        >
                          <Trash2 className="size-4" />
                        </button>
                      ) : (
                        <button
                          className="rounded-full bg-card p-1.5 text-xs shadow"
                          aria-label="Report message"
                          onClick={() => setReport({ kind: "message", id: m.id })}
                        >
                          ⚑
                        </button>
                      )}
                    </div>
                  )}
                  {picker === m.id && (
                    <div
                      className={cn(
                        "absolute z-10 mt-1 flex gap-1 rounded-full border border-border bg-card p-1 shadow-lg",
                        mine ? "right-0" : "left-0",
                      )}
                    >
                      {emojis.map((e) => (
                        <button
                          key={e}
                          className="rounded-full p-1 text-xl hover:scale-125"
                          onClick={() => {
                            setPicker(null);
                            void api(`/messages/${m.id}/react`, {
                              body: { emoji: m.reactions?.[me] === e ? null : e },
                            }).then(() => q.refetch());
                          }}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {otherRead &&
            data.messages.length > 0 &&
            data.messages[data.messages.length - 1].sender_id === me &&
            new Date(otherRead) >= new Date(data.messages[data.messages.length - 1].created_at) && (
              <p className="pr-2 text-right text-xs text-muted-foreground">Seen</p>
            )}
          {typing && (
            <p className="pl-2 text-xs font-bold text-muted-foreground" aria-live="polite">
              {typing} is typing…
            </p>
          )}
          <div ref={endRef} />
        </div>

        {myStatus === "pending" ? (
          <div className="border-t border-border p-4 text-center">
            <p className="font-bold">Message request</p>
            <p className="text-sm text-muted-foreground">
              They can't see whether you've read this until you accept.
            </p>
            <div className="mt-3 flex justify-center gap-2">
              <PillButton
                variant="forest"
                onClick={() =>
                  void api(`/messages/conversations/${id}/request`, {
                    body: { accept: true },
                  }).then(() => q.refetch())
                }
              >
                Accept
              </PillButton>
              <PillButton
                variant="outline"
                onClick={() =>
                  void api(`/messages/conversations/${id}/request`, {
                    body: { accept: false },
                  }).then(() => navigate({ to: "/messages" }))
                }
              >
                Decline
              </PillButton>
            </div>
          </div>
        ) : (
          <form
            className="border-t border-border p-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!text.trim()) return;
              void send({ body: text, kind: "text" });
              setText("");
            }}
          >
            {replyTo && (
              <p className="mb-2 flex items-center justify-between rounded-xl bg-muted px-3 py-1.5 text-xs">
                <span className="truncate">Replying to: {replyTo.body || `[${replyTo.kind}]`}</span>
                <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply">
                  <X className="size-4" />
                </button>
              </p>
            )}
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="rounded-full p-2.5 hover:bg-muted"
                aria-label="Send image"
              >
                <ImagePlus className="size-5" />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0], "image")}
              />
              <button
                type="button"
                onClick={() => void toggleRecord()}
                className={cn(
                  "rounded-full p-2.5 hover:bg-muted",
                  recording && "animate-pulse bg-coral text-coral-foreground",
                )}
                aria-label={recording ? "Stop recording" : "Record voice note"}
              >
                {recording ? <Square className="size-5" /> : <Mic className="size-5" />}
              </button>
              <textarea
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  if (Date.now() - lastTyping.current > 3000) {
                    lastTyping.current = Date.now();
                    void api(`/messages/conversations/${id}/typing`, { method: "POST" }).catch(
                      () => {},
                    );
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    (e.currentTarget.form as HTMLFormElement).requestSubmit();
                  }
                }}
                rows={1}
                maxLength={4000}
                placeholder="Write a message…"
                aria-label="Message"
                className="max-h-32 flex-1 resize-none rounded-2xl bg-muted px-4 py-2.5 font-semibold outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="submit"
                disabled={!text.trim()}
                className="rounded-full bg-forest p-3 text-forest-foreground disabled:opacity-40"
                aria-label="Send"
              >
                <Send className="size-5" />
              </button>
            </div>
          </form>
        )}
      </div>
      {report && <ReportDialog kind={report.kind} id={report.id} onClose={() => setReport(null)} />}
    </AppShell>
  );
}
