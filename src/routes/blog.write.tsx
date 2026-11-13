import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PublicLayout } from "@/components/public-layout";
import { PillButton } from "@/components/app-shell";
import { ErrorNote, Field, inputCls } from "@/components/kit";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { topicLabel } from "./blog.index";

export const Route = createFileRoute("/blog/write")({
  head: () => ({ meta: [{ title: "Park a thought — Pause." }] }),
  component: WriteBlog,
});

function WriteBlog() {
  const { user } = useSession();
  const [f, setF] = useState({
    penName: "",
    title: "",
    body: "",
    topic: "thoughts",
    contactEmail: "",
    website: "",
  });
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const minor = !!user && user.ageGroup !== "adult";

  return (
    <PublicLayout>
      <div className="mx-auto max-w-2xl px-5 py-14">
        <h1 className="font-display text-5xl font-black tracking-tight">Park a thought</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Write whatever's on your mind — a struggle, a small win, something you wish someone had
          told you. A moderator reads every piece before it goes up, and once it's published it
          stays.
        </p>
        {minor ? (
          <div className="card-soft mt-8 p-6">
            <p className="font-bold">The blog is for adults (18+).</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Your journal is a private, safe place for your thoughts.
            </p>
            <Link to="/journal" className="mt-4 inline-block font-bold underline">
              Open my journal
            </Link>
          </div>
        ) : done ? (
          <div className="card-soft mt-8 p-8 text-center">
            <p className="pop-in text-6xl">🪶</p>
            <h2 className="mt-4 font-display text-3xl font-bold">Thank you for sharing</h2>
            <p className="mt-2 text-muted-foreground">
              Your piece is waiting for a gentle review. Once it's approved it'll appear on the
              blog.
            </p>
            <Link to="/blog" className="mt-6 inline-block font-bold underline">
              Read other stories
            </Link>
          </div>
        ) : (
          <form
            className="card-soft mt-8 space-y-4 p-6"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError(null);
              try {
                await api("/blog", {
                  body: {
                    ...f,
                    website: f.website || undefined,
                    contactEmail: f.contactEmail || undefined,
                    adult: true,
                  },
                });
                setDone(true);
              } catch (err) {
                setError(err);
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Pen name (optional)" hint="Leave blank to post as Anonymous.">
                <input
                  maxLength={40}
                  value={f.penName}
                  onChange={(e) => setF({ ...f, penName: e.target.value })}
                  className={inputCls}
                  placeholder="Anonymous"
                />
              </Field>
              <Field label="Topic">
                <select
                  value={f.topic}
                  onChange={(e) => setF({ ...f, topic: e.target.value })}
                  className={inputCls}
                >
                  {Object.entries(topicLabel).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Title">
              <input
                required
                minLength={3}
                maxLength={120}
                value={f.title}
                onChange={(e) => setF({ ...f, title: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field
              label="Your thoughts"
              hint="Please leave out real names, places or anything that could identify you or someone else."
            >
              <textarea
                required
                minLength={40}
                maxLength={12000}
                rows={12}
                value={f.body}
                onChange={(e) => setF({ ...f, body: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field
              label="Email (optional, never published)"
              hint="Only if you'd like us to let you know when it's live."
            >
              <input
                type="email"
                value={f.contactEmail}
                onChange={(e) => setF({ ...f, contactEmail: e.target.value })}
                className={inputCls}
              />
            </Field>
            <input
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="hidden"
              value={f.website}
              onChange={(e) => setF({ ...f, website: e.target.value })}
            />
            <label className="flex items-start gap-3 text-sm font-semibold">
              <input
                type="checkbox"
                checked={adult}
                onChange={(e) => setAdult(e.target.checked)}
                className="mt-1 size-5"
              />
              I'm 18 or older, and I'm happy for this to be published publicly (without my email)
              after review.
            </label>
            <ErrorNote error={error} />
            <PillButton type="submit" variant="coral" className="w-full" disabled={busy || !adult}>
              {busy ? "Sending…" : "Submit for review"}
            </PillButton>
          </form>
        )}
      </div>
    </PublicLayout>
  );
}
