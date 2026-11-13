import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";
import { Bookmark, ImagePlus, MessageCircle, MoreHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { PillButton } from "@/components/app-shell";
import { Avatar, inputCls } from "@/components/kit";
import { api, mediaUrl, timeAgo } from "@/lib/api";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";

export const reactions = [
  { kind: "heart", emoji: "💛", label: "Love" },
  { kind: "hug", emoji: "🤗", label: "Hug" },
  { kind: "strength", emoji: "💪", label: "Strength" },
  { kind: "relate", emoji: "🫂", label: "Relate" },
  { kind: "celebrate", emoji: "🎉", label: "Celebrate" },
] as const;

export function ReportDialog({
  kind,
  id,
  onClose,
}: {
  kind: "post" | "comment" | "user" | "message" | "community";
  id: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("harassment");
  const [details, setDetails] = useState("");
  const reasons: [string, string][] = [
    ["harassment", "Harassment or bullying"],
    ["hate", "Hate speech"],
    ["self_harm", "Someone may be at risk of self-harm"],
    ["spam", "Spam or selling"],
    ["sexual", "Sexual content"],
    ["violence", "Threats or violence"],
    ["privacy", "Shares someone's private information"],
    ["underage", "I think this person is under 18"],
    ["misinformation", "Harmful misinformation"],
    ["other", "Something else"],
  ];
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Report"
    >
      <div className="w-full max-w-md rounded-3xl bg-card p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">Report</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1 hover:bg-muted">
            <X className="size-5" />
          </button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Reports are confidential. Our moderators review every one.
        </p>
        <div className="mt-4 space-y-1">
          {reasons.map(([k, l]) => (
            <label
              key={k}
              className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-muted"
            >
              <input
                type="radio"
                name="reason"
                checked={reason === k}
                onChange={() => setReason(k)}
              />
              <span className="text-sm font-semibold">{l}</span>
            </label>
          ))}
        </div>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="Anything else we should know? (optional)"
          className={cn(inputCls, "mt-3")}
        />
        {reason === "self_harm" && (
          <p className="mt-2 rounded-xl bg-coral/30 p-2 text-xs font-bold">
            If someone is in immediate danger, contact local emergency services. We'll prioritise
            this report.
          </p>
        )}
        <PillButton
          variant="coral"
          className="mt-4 w-full"
          onClick={async () => {
            await api("/reports", { body: { targetKind: kind, targetId: id, reason, details } });
            toast.success("Thanks — our moderators will take a look.");
            onClose();
          }}
        >
          Send report
        </PillButton>
      </div>
    </div>
  );
}

export function PostMenu({ post, onChanged }: { post: any; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [report, setReport] = useState<null | "post" | "user">(null);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(post.body);
  const run = async (fn: () => Promise<unknown>, msg: string) => {
    setOpen(false);
    try {
      await fn();
      toast.success(msg);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    }
  };
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="rounded-full p-2 text-muted-foreground hover:bg-muted"
        aria-label="Post options"
        aria-expanded={open}
      >
        <MoreHorizontal className="size-5" />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
          {post.mine ? (
            <>
              <MenuItem onClick={() => (setEditing(true), setOpen(false))}>Edit</MenuItem>
              <MenuItem
                danger
                onClick={() =>
                  confirm("Delete this post?") &&
                  void run(
                    () => api(`/community/posts/${post.id}`, { method: "DELETE" }),
                    "Post deleted",
                  )
                }
              >
                Delete
              </MenuItem>
            </>
          ) : (
            <>
              <MenuItem onClick={() => (setReport("post"), setOpen(false))}>Report post</MenuItem>
              {post.author_id && (
                <>
                  <MenuItem
                    onClick={() =>
                      void run(
                        () => api(`/community/users/${post.author_id}/mute`, { method: "POST" }),
                        "Muted. You can undo this in Settings.",
                      )
                    }
                  >
                    Mute {post.author_name}
                  </MenuItem>
                  <MenuItem
                    danger
                    onClick={() =>
                      confirm(
                        `Block ${post.author_name}? They won't be able to see your posts or message you.`,
                      ) &&
                      void run(
                        () => api(`/community/users/${post.author_id}/block`, { method: "POST" }),
                        "Blocked",
                      )
                    }
                  >
                    Block {post.author_name}
                  </MenuItem>
                </>
              )}
            </>
          )}
        </div>
      )}
      {report && <ReportDialog kind="post" id={post.id} onClose={() => setReport(null)} />}
      {editing && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Edit post"
        >
          <div className="w-full max-w-lg rounded-3xl bg-card p-6">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              maxLength={4000}
              className={inputCls}
            />
            <div className="mt-3 flex justify-end gap-2">
              <PillButton variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </PillButton>
              <PillButton
                variant="forest"
                onClick={() =>
                  void run(async () => {
                    await api(`/community/posts/${post.id}`, {
                      method: "PATCH",
                      body: { body: text },
                    });
                    setEditing(false);
                  }, "Post updated")
                }
              >
                Save
              </PillButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "block w-full px-4 py-2.5 text-left text-sm font-bold hover:bg-muted",
        danger && "text-destructive",
      )}
    >
      {children}
    </button>
  );
}

function renderBody(text: string) {
  return text.split(/(#[A-Za-z][A-Za-z0-9_]{1,30})/g).map((part, i) =>
    part.startsWith("#") ? (
      <span key={i} className="font-bold text-forest">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

export function PostCard({
  post,
  onChanged,
  full = false,
}: {
  post: any;
  onChanged: () => void;
  full?: boolean;
}) {
  const [mine, setMine] = useState<string | null>(post.my_reaction);
  const [count, setCount] = useState<number>(post.reactions);
  const [saved, setSaved] = useState<boolean>(post.saved);
  const [picker, setPicker] = useState(false);
  const react = async (kind: string | null) => {
    setPicker(false);
    const prev = mine;
    setMine(kind);
    setCount((c) => c + (kind && !prev ? 1 : !kind && prev ? -1 : 0));
    try {
      await api(`/community/posts/${post.id}/react`, { body: { kind } });
    } catch (e) {
      setMine(prev);
      toast.error(e instanceof Error ? e.message : "Couldn't react");
    }
  };
  const current = reactions.find((r) => r.kind === mine);
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-soft p-5"
    >
      <header className="flex items-start gap-3">
        {post.author_username ? (
          <Link to="/u/$handle" params={{ handle: post.author_username }}>
            <Avatar style={post.author_style} imageId={post.author_avatar} size={44} />
          </Link>
        ) : (
          <Avatar style="anon" size={44} />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-bold">
            {post.author_username ? (
              <Link
                to="/u/$handle"
                params={{ handle: post.author_username }}
                className="hover:underline"
              >
                {post.author_name}
              </Link>
            ) : (
              post.author_name
            )}
            {post.kind === "milestone" && (
              <span className="ml-2 rounded-full bg-mustard px-2 py-0.5 text-xs">🏅 Milestone</span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {timeAgo(post.created_at)}
            {post.community_slug && (
              <>
                {" · in "}
                <Link
                  to="/community/c/$slug"
                  params={{ slug: post.community_slug }}
                  className="font-bold hover:underline"
                >
                  {post.community_name}
                </Link>
              </>
            )}
            {post.edited_at && " · edited"}
          </p>
        </div>
        <PostMenu post={post} onChanged={onChanged} />
      </header>
      <Link to="/community/post/$id" params={{ id: post.id }} className="block">
        <p className={cn("mt-3 leading-relaxed whitespace-pre-wrap", !full && "line-clamp-[8]")}>
          {renderBody(post.body)}
        </p>
        {post.image_id && (
          <img
            src={mediaUrl(post.image_id)}
            alt=""
            loading="lazy"
            className="mt-3 max-h-[480px] w-full rounded-2xl border border-border object-cover"
          />
        )}
      </Link>
      <footer className="relative mt-4 flex items-center gap-1">
        <button
          onClick={() => (mine ? void react(null) : setPicker(!picker))}
          onContextMenu={(e) => (e.preventDefault(), setPicker(true))}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold transition-colors",
            mine ? "bg-mustard" : "hover:bg-muted",
          )}
          aria-label={mine ? `Remove ${current?.label} reaction` : "React"}
        >
          <span aria-hidden="true">{current?.emoji ?? "🤍"}</span> {count > 0 ? count : "Support"}
        </button>
        {!mine && (
          <button
            onClick={() => setPicker(!picker)}
            className="rounded-full px-2 py-2 text-xs font-bold text-muted-foreground hover:bg-muted"
            aria-label="Choose reaction"
          >
            ▾
          </button>
        )}
        <AnimatePresence>
          {picker && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute bottom-12 left-0 z-10 flex gap-1 rounded-full border border-border bg-card p-1.5 shadow-lg"
            >
              {reactions.map((r) => (
                <button
                  key={r.kind}
                  onClick={() => void react(r.kind)}
                  className="rounded-full p-1.5 text-2xl transition-transform hover:scale-125"
                  aria-label={r.label}
                  title={r.label}
                >
                  {r.emoji}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        <Link
          to="/community/post/$id"
          params={{ id: post.id }}
          className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold hover:bg-muted"
        >
          <MessageCircle className="size-4" /> {post.comments > 0 ? post.comments : "Reply"}
        </Link>
        <button
          onClick={async () => {
            const r = await api<{ saved: boolean }>(`/community/posts/${post.id}/save`, {
              method: "POST",
            });
            setSaved(r.saved);
            toast.success(r.saved ? "Saved" : "Removed from saved");
          }}
          className={cn("ml-auto rounded-full p-2 hover:bg-muted", saved && "text-forest")}
          aria-label={saved ? "Unsave" : "Save"}
          aria-pressed={saved}
        >
          <Bookmark className={cn("size-5", saved && "fill-current")} />
        </button>
      </footer>
    </motion.article>
  );
}

export function Composer({
  communities,
  defaultCommunityId,
  prompt,
  onPosted,
}: {
  communities: any[];
  defaultCommunityId?: string;
  prompt?: string;
  onPosted: () => void;
}) {
  const { user } = useSession();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [communityId, setCommunityId] = useState(defaultCommunityId ?? "");
  const [anonymous, setAnonymous] = useState(false);
  const [image, setImage] = useState<{ id: string; preview: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const joined = communities.filter((c) => c.my_role);

  if (user && !user.emailVerified) {
    return (
      <div className="card-soft p-5">
        <p className="font-bold">Verify your email to post</p>
        <p className="mt-1 text-sm text-muted-foreground">
          It keeps the community safe from spam. You can read and react in the meantime.
        </p>
        <button
          className="mt-2 text-sm font-bold underline"
          onClick={() =>
            void api("/auth/resend-verification", { method: "POST" }).then(() =>
              toast.success("Verification email sent"),
            )
          }
        >
          Resend verification email
        </button>
      </div>
    );
  }

  const upload = async (file: File) => {
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Images must be under 4 MB.");
      return;
    }
    try {
      const r = await api<{ id: string }>("/media?scope=public", {
        raw: file,
        headers: { "content-type": file.type },
      });
      setImage({ id: r.id, preview: URL.createObjectURL(file) });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    }
  };

  return (
    <form
      className="card-soft p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!body.trim()) return;
        setBusy(true);
        try {
          const r = await api<{ status: string }>("/community/posts", {
            body: { body, communityId: communityId || null, imageId: image?.id ?? null, anonymous },
          });
          setBody("");
          setImage(null);
          toast.success(
            r.status === "pending"
              ? "Thanks — your post will appear after a quick review."
              : "Posted 🌿",
          );
          void qc.invalidateQueries({ queryKey: ["feed"] });
          onPosted();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Couldn't post");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="flex gap-3">
        <Avatar style={anonymous ? "anon" : user?.avatarStyle} size={44} />
        <div className="flex-1">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={4000}
            rows={3}
            placeholder={
              prompt
                ? `${prompt}`
                : "Share how you're doing, a small win, or what's weighing on you…"
            }
            className="w-full resize-none rounded-2xl bg-muted px-4 py-3 text-base font-semibold outline-none focus:ring-2 focus:ring-ring"
            aria-label="Write a post"
          />
          {image && (
            <div className="relative mt-2 w-fit">
              <img src={image.preview} alt="Attached" className="max-h-48 rounded-2xl" />
              <button
                type="button"
                onClick={() => setImage(null)}
                className="absolute top-1 right-1 rounded-full bg-ink/70 p-1 text-card"
                aria-label="Remove image"
              >
                <X className="size-4" />
              </button>
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-full p-2 hover:bg-muted"
              aria-label="Add image"
            >
              <ImagePlus className="size-5" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])}
            />
            <select
              value={communityId}
              onChange={(e) => setCommunityId(e.target.value)}
              className="rounded-full border-2 border-border bg-card px-3 py-1.5 text-sm font-bold"
              aria-label="Post in"
            >
              <option value="">Everyone</option>
              {joined.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-sm font-bold">
              <input
                type="checkbox"
                checked={anonymous}
                onChange={(e) => setAnonymous(e.target.checked)}
              />{" "}
              Fully anonymous
            </label>
            <PillButton
              type="submit"
              variant="forest"
              className="ml-auto min-h-10 px-5 py-2"
              disabled={busy || !body.trim()}
            >
              {busy ? "Posting…" : "Post"}
            </PillButton>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {anonymous
              ? "No name at all — not even your pseudonym."
              : `Posting as ${user?.identityMode === "name" ? user.displayName : user?.communityAlias}.`}{" "}
            Photo location data is removed automatically.
          </p>
        </div>
      </div>
    </form>
  );
}
