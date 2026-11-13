import { Link, createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { PublicLayout } from "@/components/public-layout";

/** Edit these two lines to change how the founder is named on the page. */
const FOUNDER_NAME = "Shivin";
const FOUNDER_ROLE = "Founder, Pause.";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About us — Pause." },
      {
        name: "description",
        content:
          "Why Pause exists: a founder's story of football, an unnamed restless mind, chasing dopamine — and learning to pause.",
      },
    ],
  }),
  component: About,
});

const chapters: { emoji: string; title: string; paras: string[] }[] = [
  {
    emoji: "⚡",
    title: "The restless kid",
    paras: [
      "For as long as I can remember, my mind ran faster than the room around me. Sitting still felt like holding my breath. Teachers called it not paying attention. Some days I called it worse things myself.",
      "Nobody ever gave it a name. Not a teacher, not a doctor, not me. I just grew up believing I was a bit too much and never quite enough — both at the same time.",
    ],
  },
  {
    emoji: "⚽",
    title: "The one place it made sense",
    paras: [
      "Then there was football. On the pitch, all that noise in my head finally had somewhere to go. The speed, the instinct, the hundred tiny decisions every minute — the things that got me in trouble everywhere else were exactly what the game asked of me.",
      "Football taught me discipline when nothing else could reach me. It gave me a team when I felt alone, a reason to show up, and the first proof that the way my brain worked could be a strength.",
    ],
  },
  {
    emoji: "🃏",
    title: "Chasing the next high",
    paras: [
      "But the final whistle always came, and the quiet afterwards was the hardest part. So I looked for that rush elsewhere. Poker tables. Cigarettes. Anything fast, anything bright, anything that gave my mind the hit it was always hungry for.",
      "It never felt like a choice. It felt like scratching an itch that never stopped. Each one built the habit a little deeper: more stimulation, less peace. I was always switched on, and never actually OK.",
    ],
  },
  {
    emoji: "🌱",
    title: "Learning to pause",
    paras: [
      "There wasn't one dramatic turning point. There were a lot of small ones: noticing the pattern. Understanding that a mind like mine — one that looks a lot like ADHD, something I lived with undiagnosed for most of my life — chases dopamine because it's hungry, not because it's broken.",
      "What helped wasn't willpower. It was understanding. Slowing down long enough to notice what I was feeling before I reached for the next thing. Breathing. Writing it down. Moving my body. Talking to people who got it. Swapping the next high for something steadier, one day at a time.",
    ],
  },
];

function FounderPhoto() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const img = new Image();
    img.onload = () => setOk(true);
    img.src = "/founder.jpg";
  }, []);
  return ok ? (
    <img
      src="/founder.jpg"
      alt={`${FOUNDER_NAME}, founder of Pause`}
      className="aspect-[3/4] w-full rounded-[2rem] border-2 border-ink object-cover shadow-xl"
    />
  ) : (
    <div
      className="grid aspect-[3/4] w-full place-items-center rounded-[2rem] border-2 border-ink bg-gradient-to-br from-primary via-lavender to-blush shadow-xl"
      role="img"
      aria-label={`${FOUNDER_NAME}, founder of Pause`}
    >
      <span className="text-8xl">⚽</span>
    </div>
  );
}

function About() {
  return (
    <PublicLayout>
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pt-14 pb-6 lg:grid-cols-[1.2fr_1fr]">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <p className="text-sm font-black tracking-wide text-forest uppercase">About us</p>
          <h1 className="mt-3 font-display text-5xl leading-[1.03] font-black tracking-tight sm:text-6xl">
            I built Pause for the kid
            <br />
            <span className="text-gradient">I used to be.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            A restless mind with no name for what it was feeling. A football pitch that felt like
            the only safe place. And years of chasing the next rush to fill the quiet. This is why
            Pause exists.
          </p>
          <p className="mt-6 font-display text-xl font-bold">
            — {FOUNDER_NAME}, <span className="text-muted-foreground">{FOUNDER_ROLE}</span>
          </p>
        </motion.div>
        <motion.div
          className="mx-auto w-full max-w-sm"
          initial={{ opacity: 0, scale: 0.96, rotate: 2 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
        >
          <FounderPhoto />
        </motion.div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-10">
        <ol className="relative space-y-10 border-l-2 border-dashed border-forest/40 pl-8">
          {chapters.map((c, i) => (
            <motion.li
              key={c.title}
              className="relative"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
            >
              <span
                className="absolute top-0 -left-[3.1rem] grid size-11 place-items-center rounded-full border-2 border-ink bg-card text-2xl shadow"
                aria-hidden="true"
              >
                {c.emoji}
              </span>
              <h2 className="font-display text-3xl font-black">{c.title}</h2>
              {c.paras.map((p) => (
                <p key={p.slice(0, 20)} className="mt-4 text-lg leading-relaxed">
                  {p}
                </p>
              ))}
            </motion.li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-4xl px-5 py-8">
        <blockquote className="rounded-[2rem] border-2 border-ink bg-forest p-8 text-forest-foreground sm:p-12">
          <p className="font-display text-3xl leading-snug font-bold sm:text-4xl">
            "Between the urge and the action, there's a moment. A breath. A pause. Learning to find
            it changed my life — and I want everyone to have a place that helps them find theirs."
          </p>
          <footer className="mt-6 font-bold opacity-80">— {FOUNDER_NAME}</footer>
        </blockquote>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-10">
        <h2 className="text-center font-display text-4xl font-black">What we do</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
          Pause is the place I wish I'd had — at seven, at fifteen, and at twenty-five. A calm home
          for every age, built around one simple idea: notice what you feel, before you reach for
          the next thing.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            [
              "🧒",
              "Name it early",
              "Kids learn feelings through pictures, games and stories — so nobody grows up without words for what's going on inside.",
            ],
            [
              "🎧",
              "Space for teens",
              "Private journaling, rhythm games and a companion that listens — without judgement, without an audience.",
            ],
            [
              "🫂",
              "No one recovers alone",
              "An anonymous adult community and recovery circles for anyone fighting their own version of the next high.",
            ],
            [
              "🫁",
              "Calm on demand",
              "Breathing, grounding and short games that give a racing mind something steady to hold on to.",
            ],
            [
              "🌱",
              "Progress, not perfection",
              "A garden that only grows. No streaks to break, no punishment for hard days.",
            ],
            [
              "🔒",
              "Safe by design",
              "Private by default, anonymous where it matters, and age protections built into the foundations.",
            ],
          ].map(([e, t, b]) => (
            <div key={t} className="card-soft lift p-6">
              <span className="text-4xl" aria-hidden="true">
                {e}
              </span>
              <h3 className="mt-3 font-display text-xl font-bold">{t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{b}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-10 text-center">
        <h2 className="font-display text-4xl font-black">Your story matters too.</h2>
        <p className="mt-3 text-muted-foreground">
          Park a thought on our community blog — anonymously if you like. Someone out there needs to
          read it.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            to="/blog/write"
            className="inline-flex min-h-12 items-center rounded-full border-2 border-ink bg-coral px-7 font-bold text-coral-foreground"
          >
            Share your story
          </Link>
          <Link
            to="/signup"
            className="inline-flex min-h-12 items-center rounded-full border-2 border-ink bg-card px-7 font-bold"
          >
            Join Pause
          </Link>
        </div>
        <p className="mt-8 text-xs text-muted-foreground">
          This is one person's lived experience, not medical advice. If you think you might have
          ADHD or are struggling with addiction, please talk to a qualified professional. Pause is a
          wellness tool, not a substitute for diagnosis or treatment.
        </p>
      </section>
    </PublicLayout>
  );
}
