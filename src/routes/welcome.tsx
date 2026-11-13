import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { PillButton } from "@/components/app-shell";
import { Avatar, Toggle, avatarStyles } from "@/components/kit";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/welcome")({
  head: () => ({ meta: [{ title: "Welcome — Pause." }] }),
  component: Welcome,
});

const interests = [
  "Anxiety & stress",
  "Sleep",
  "Mindfulness",
  "Recovery",
  "Burnout",
  "Grief",
  "Self-esteem",
  "Relationships",
  "Parenting",
  "Student life",
  "Creativity",
  "Fitness",
];

function Welcome() {
  const { user, refresh } = useSession();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [style, setStyle] = useState(user?.avatarStyle ?? "leaf");
  const [picked, setPicked] = useState<string[]>([]);
  const [memory, setMemory] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!user) return null;
  const finish = async (to: "/home" | "/family") => {
    setBusy(true);
    await api("/me", {
      method: "PATCH",
      body: {
        avatarStyle: style,
        interests: picked,
        memoryConsent: memory,
        appData: { tutorialDone: false },
      },
    }).catch(() => {});
    await refresh();
    await qc.invalidateQueries();
    navigate({ to });
  };

  const steps = [
    <div key="0">
      <p className="text-6xl">🌿</p>
      <h1 className="mt-4 font-display text-4xl font-black">Welcome, {user.displayName}.</h1>
      <p className="mt-3 text-lg text-muted-foreground">
        Pause is your calm corner — for checking in, writing it down, breathing, playing, and (if
        you want) talking with people who get it.
      </p>
      <div className="mt-6 rounded-2xl bg-lavender/60 p-5">
        <p className="text-sm font-bold">Your anonymous community name</p>
        <p className="mt-1 font-display text-3xl font-black">{user.communityAlias}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          This is the only name other members will ever see. Your real name, email and username stay
          private. You can change it any time in Settings.
        </p>
      </div>
      <PillButton variant="coral" className="mt-8 w-full" onClick={() => setStep(1)}>
        Let's set things up
      </PillButton>
    </div>,
    <div key="1">
      <h1 className="font-display text-3xl font-black">Pick your avatar</h1>
      <p className="mt-2 text-muted-foreground">No photos needed — this keeps you anonymous.</p>
      <div className="mt-6 grid grid-cols-4 gap-3 sm:grid-cols-6">
        {Object.entries(avatarStyles)
          .filter(([k]) => k !== "anon")
          .map(([k, v]) => (
            <button
              key={k}
              onClick={() => setStyle(k)}
              aria-pressed={style === k}
              aria-label={v.label}
              className={cn(
                "grid place-items-center rounded-2xl p-2 transition-transform",
                style === k && "scale-110 ring-4 ring-ring",
              )}
            >
              <Avatar style={k} size={56} />
            </button>
          ))}
      </div>
      <h2 className="mt-8 font-display text-xl font-bold">What would you like support with?</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {interests.map((i) => (
          <button
            key={i}
            onClick={() => setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]))}
            aria-pressed={picked.includes(i)}
            className={cn(
              "rounded-full border-2 px-4 py-2 text-sm font-bold",
              picked.includes(i) ? "border-ink bg-mustard" : "border-border bg-card",
            )}
          >
            {i}
          </button>
        ))}
      </div>
      <PillButton variant="coral" className="mt-8 w-full" onClick={() => setStep(2)}>
        Next
      </PillButton>
    </div>,
    <div key="2">
      <h1 className="font-display text-3xl font-black">A few promises, and one choice</h1>
      <ul className="mt-5 space-y-3 text-sm font-semibold">
        <li>🔒 Your journal, check-ins and Pip chats are private to you.</li>
        <li>
          🤖 Pip is an AI. It listens and reflects — it never diagnoses and isn't a therapist.
        </li>
        <li>
          🆘 If something you write suggests you're in danger, crisis help appears on screen
          straight away.
        </li>
        <li>🗑️ You can export or delete everything, any time.</li>
      </ul>
      <div className="card-soft mt-6 px-5">
        <Toggle
          checked={memory}
          onChange={setMemory}
          label="Let Pip remember our conversations"
          description="Pip uses short recaps of past chats so you don't have to repeat yourself. Off by default; change it any time."
        />
      </div>
      <div className="mt-8 grid gap-3">
        <PillButton variant="coral" disabled={busy} onClick={() => void finish("/home")}>
          Start using Pause
        </PillButton>
        <PillButton variant="outline" disabled={busy} onClick={() => void finish("/family")}>
          I'm a parent — set up my child's profile
        </PillButton>
      </div>
    </div>,
  ];

  return (
    <div className="relative min-h-dvh">
      <div className="aurora" aria-hidden="true" />
      <div className="mx-auto max-w-xl px-5 py-12">
        <div className="mb-8 flex gap-2" aria-label={`Step ${step + 1} of 3`}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={cn(
                "h-2 flex-1 rounded-full transition-colors",
                i <= step ? "bg-forest" : "bg-muted",
              )}
            />
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            className="card-soft p-7"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
          >
            {steps[step]}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
