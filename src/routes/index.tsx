import { Link, createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import { BookOpen, Gamepad2, Heart, Lock, Shield, Sprout, Users, Wind } from "lucide-react";
import { PublicLayout } from "@/components/public-layout";
import { Companion } from "@/components/companion-character";
import { WeatherIcon } from "@/components/illustrations";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pause. — Mental wellness for every age" },
      {
        name: "description",
        content:
          "A calm, private space for kids, teens and adults: an AI companion, mood tracking, journaling, calming games, a growth garden and an anonymous recovery community.",
      },
    ],
  }),
  component: Landing,
});

const ages = [
  {
    range: "4–7",
    title: "Little ones",
    body: "Parent-led. Feelings cards, breathing bubbles, colouring and calm stories — no chat, no social, no ads.",
    emoji: "🧸",
    hue: 85,
  },
  {
    range: "8–12",
    title: "Explorers",
    body: "Guided independence. Adventures, feeling games, daily challenges and a garden that grows — with a grown-up nearby.",
    emoji: "🧭",
    hue: 180,
  },
  {
    range: "13–17",
    title: "Teens",
    body: "Your space, your words. Journaling, rhythm games, avatars and privacy you control.",
    emoji: "🎧",
    hue: 300,
  },
  {
    range: "18+",
    title: "Adults",
    body: "The full platform: Pip, insights, recovery tools and an anonymous peer community.",
    emoji: "🌿",
    hue: 150,
  },
];

const features = [
  {
    icon: Heart,
    title: "Pip, your AI companion",
    body: "Listens, reflects and offers grounding — never diagnoses, never pretends to be a therapist.",
  },
  {
    icon: BookOpen,
    title: "Journal & mood weather",
    body: "Daily check-ins as weather, guided prompts, gratitude and drawings. Private by default.",
  },
  {
    icon: Wind,
    title: "Mindfulness",
    body: "Breathing, grounding, sleep wind-downs and short daily calm.",
  },
  {
    icon: Gamepad2,
    title: "10 calming games",
    body: "Memory, focus, rhythm, puzzles and feeling games — playful, never competitive about feelings.",
  },
  {
    icon: Sprout,
    title: "A garden that only grows",
    body: "Every check-in adds something. Nothing wilts. Hard days count too.",
  },
  {
    icon: Users,
    title: "Anonymous community",
    body: "18+ peer support with pseudonyms by default, recovery circles and safe messaging.",
  },
];

function Landing() {
  return (
    <PublicLayout>
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pt-14 pb-10 lg:grid-cols-2 lg:pt-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <p className="inline-flex items-center gap-2 rounded-full bg-card/80 px-3 py-1 text-sm font-bold text-forest">
            <Lock className="size-4" /> Private by design · anonymous community
          </p>
          <h1 className="mt-5 font-display text-5xl leading-[1.02] font-black tracking-tight sm:text-6xl lg:text-7xl">
            Take a breath.
            <br />
            <span className="text-gradient">Take a Pause.</span>
          </h1>
          <p className="mt-5 max-w-lg text-lg text-muted-foreground">
            A gentle mental-wellness space that grows with you — from a four-year-old's first
            feelings to an adult's recovery journey. One calm home, four age-perfect experiences.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/signup"
              className="inline-flex min-h-12 items-center rounded-full border-2 border-ink bg-coral px-7 text-lg font-bold text-coral-foreground transition-transform hover:-translate-y-0.5"
            >
              Start free
            </Link>
            <Link
              to="/pricing"
              className="inline-flex min-h-12 items-center rounded-full border-2 border-ink bg-card px-7 text-lg font-bold transition-transform hover:-translate-y-0.5"
            >
              See Premium · $3/mo
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Free forever plan. Under 18? A parent or guardian sets you up from their account.
          </p>
        </motion.div>

        <motion.div
          className="relative mx-auto w-full max-w-md"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.15 }}
        >
          <div className="card-soft relative overflow-hidden p-6">
            <div className="flex items-center gap-4">
              <Companion className="float-slow size-20 text-forest" />
              <div>
                <p className="font-display text-xl font-bold">Hi, I'm Pip.</p>
                <p className="text-sm text-muted-foreground">
                  What's the weather like inside today?
                </p>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-5 gap-2">
              {(["sunny", "partly", "cloudy", "rainy", "stormy"] as const).map((s, i) => (
                <motion.div
                  key={s}
                  className="grid aspect-square place-items-center rounded-2xl border-2 border-border bg-muted"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.08 }}
                >
                  <WeatherIcon sky={s} className="size-9 text-ink" />
                </motion.div>
              ))}
            </div>
            <div className="mt-5 rounded-2xl bg-primary/60 p-4 text-sm font-semibold">
              "It sounds like the deadline landing on top of everything this week really piled up.
              What part is sitting heaviest?"
            </div>
            <div className="mt-4 flex items-center justify-between text-xs font-bold text-muted-foreground">
              <span>🌱 12 things growing in your garden</span>
              <span>🫧 3 calm breaths today</span>
            </div>
          </div>
          <div
            className="absolute -top-6 -right-2 rotate-6 rounded-2xl bg-mustard px-4 py-2 text-sm font-black shadow-lg"
            aria-hidden="true"
          >
            No ads. Ever.
          </div>
        </motion.div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-12">
        <h2 className="text-center font-display text-4xl font-black tracking-tight">
          Made for every age
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
          Same calm brand, completely different experience — and age rules enforced on our servers,
          not just hidden in the interface.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ages.map((a, i) => (
            <motion.div
              key={a.range}
              className="card-soft lift p-6"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
            >
              <span
                className="grid size-14 place-items-center rounded-2xl text-3xl"
                style={{
                  background: `linear-gradient(135deg, oklch(0.92 0.08 ${a.hue}), oklch(0.82 0.12 ${a.hue + 40}))`,
                }}
                aria-hidden="true"
              >
                {a.emoji}
              </span>
              <p className="mt-4 text-sm font-black text-forest">Ages {a.range}</p>
              <h3 className="font-display text-2xl font-bold">{a.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{a.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-12">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              className="glass rounded-3xl p-6"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
            >
              <f.icon className="size-7 text-forest" aria-hidden="true" />
              <h3 className="mt-3 font-display text-xl font-bold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 py-12">
        <div className="card-soft grid gap-6 p-8 sm:grid-cols-[auto_1fr] sm:items-center">
          <Shield className="size-14 text-forest" aria-hidden="true" />
          <div>
            <h2 className="font-display text-3xl font-black">Your privacy is the product</h2>
            <ul className="mt-3 grid gap-2 text-sm font-semibold sm:grid-cols-2">
              <li>🔒 Journals and conversations are private by default</li>
              <li>🫥 Community uses pseudonyms — your name is never shown</li>
              <li>📍 Photo location data is stripped automatically</li>
              <li>👨‍👩‍👧 Children's profiles are guardian-managed</li>
              <li>🚫 No advertising, no selling data, no profiling</li>
              <li>🗑️ Export or delete everything, any time</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-12 text-center">
        <h2 className="font-display text-4xl font-black">Ready when you are.</h2>
        <p className="mt-3 text-muted-foreground">Start free in under a minute. No card needed.</p>
        <Link
          to="/signup"
          className="mt-6 inline-flex min-h-12 items-center rounded-full border-2 border-ink bg-coral px-8 text-lg font-bold text-coral-foreground"
        >
          Create your Pause
        </Link>
      </section>
    </PublicLayout>
  );
}
