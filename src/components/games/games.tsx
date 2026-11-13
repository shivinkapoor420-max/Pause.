import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PillButton } from "@/components/app-shell";
import { cn } from "@/lib/utils";

export type Difficulty = "easy" | "medium" | "hard";
export type GameProps = {
  difficulty: Difficulty;
  young: boolean;
  onFinish: (score: number, summary: string, extra?: { drawing?: string }) => void;
};

function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j]!, b[i]!];
  }
  return b;
}

function useSeconds(running = true) {
  const start = useRef(Date.now());
  const [s, setS] = useState(0);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setS(Math.round((Date.now() - start.current) / 1000)), 500);
    return () => clearInterval(t);
  }, [running]);
  return s;
}

// ================================================================= 1. Memory Garden
const memoryIcons = [
  "🌼",
  "🍄",
  "🐝",
  "🦋",
  "🌙",
  "⭐",
  "🍀",
  "🐞",
  "🌈",
  "🐢",
  "🌻",
  "🐚",
  "🦔",
  "🍓",
];

export function MemoryGame({ difficulty, onFinish }: GameProps) {
  const pairs = difficulty === "easy" ? 6 : difficulty === "medium" ? 8 : 12;
  const [cards] = useState(() =>
    shuffle(
      memoryIcons.slice(0, pairs).flatMap((e, i) => [
        { id: i * 2, e },
        { id: i * 2 + 1, e },
      ]),
    ),
  );
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [moves, setMoves] = useState(0);
  const secs = useSeconds(matched.size < pairs);

  useEffect(() => {
    if (open.length !== 2) return;
    const [a, b] = open.map((i) => cards[i]!);
    const t = setTimeout(
      () => {
        if (a!.e === b!.e) setMatched((m) => new Set(m).add(a!.e));
        setOpen([]);
      },
      a!.e === b!.e ? 250 : 800,
    );
    return () => clearTimeout(t);
  }, [open, cards]);

  useEffect(() => {
    if (matched.size === pairs) {
      const score = Math.max(10, 1000 - Math.max(0, moves - pairs) * 20 - secs * 2);
      setTimeout(() => onFinish(score, `All ${pairs} pairs in ${moves} moves and ${secs}s.`), 600);
    }
  }, [matched.size, pairs, moves, secs, onFinish]);

  return (
    <div>
      <p className="mb-3 text-center text-sm font-bold text-muted-foreground">
        Moves {moves} · {secs}s · {matched.size}/{pairs} pairs
      </p>
      <div
        className={cn("mx-auto grid max-w-lg gap-2", pairs === 12 ? "grid-cols-6" : "grid-cols-4")}
      >
        {cards.map((c, i) => {
          const shown = open.includes(i) || matched.has(c.e);
          return (
            <button
              key={c.id}
              aria-label={shown ? c.e : "Hidden card"}
              disabled={shown || open.length === 2}
              onClick={() => {
                setOpen((o) => [...o, i]);
                if (open.length === 1) setMoves((m) => m + 1);
              }}
              className="aspect-square [perspective:600px]"
            >
              <motion.div
                className="relative size-full [transform-style:preserve-3d]"
                animate={{ rotateY: shown ? 180 : 0 }}
                transition={{ duration: 0.35 }}
              >
                <span className="absolute inset-0 grid place-items-center rounded-2xl border-2 border-ink bg-forest text-xl text-forest-foreground [backface-visibility:hidden]">
                  🌿
                </span>
                <span
                  className={cn(
                    "absolute inset-0 grid place-items-center rounded-2xl border-2 border-ink text-3xl [backface-visibility:hidden] [transform:rotateY(180deg)] sm:text-4xl",
                    matched.has(c.e) ? "bg-primary" : "bg-card",
                  )}
                >
                  {c.e}
                </span>
              </motion.div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ================================================================= 2. Breathing Bubbles
export function BubblesGame({ difficulty, young, onFinish }: GameProps) {
  const pattern = young
    ? [3, 1, 4]
    : difficulty === "easy"
      ? [4, 2, 6]
      : difficulty === "medium"
        ? [4, 4, 6]
        : [4, 7, 8];
  const rounds = young ? 3 : difficulty === "easy" ? 4 : difficulty === "medium" ? 6 : 8;
  const [phase, setPhase] = useState<"in" | "hold" | "out">("in");
  const [round, setRound] = useState(1);
  const [popped, setPopped] = useState(0);
  const [bubbles, setBubbles] = useState<{ id: number; x: number }[]>([]);
  const idRef = useRef(0);

  useEffect(() => {
    const dur =
      (phase === "in" ? pattern[0]! : phase === "hold" ? pattern[1]! : pattern[2]!) * 1000;
    const t = setTimeout(() => {
      if (phase === "in") setPhase(pattern[1] ? "hold" : "out");
      else if (phase === "hold") setPhase("out");
      else if (round >= rounds)
        onFinish(popped, `${rounds} slow breaths, ${popped} bubbles popped.`);
      else {
        setRound((r) => r + 1);
        setPhase("in");
      }
    }, dur);
    return () => clearTimeout(t);
  }, [phase, round, rounds, pattern, popped, onFinish]);

  useEffect(() => {
    if (phase !== "out") return;
    const t = setInterval(
      () =>
        setBubbles((b) => [...b.slice(-6), { id: idRef.current++, x: 10 + Math.random() * 80 }]),
      700,
    );
    return () => clearInterval(t);
  }, [phase]);

  const label = phase === "in" ? "Breathe in…" : phase === "hold" ? "Hold gently…" : "Breathe out…";
  const secs = phase === "in" ? pattern[0]! : phase === "hold" ? pattern[1]! : pattern[2]!;
  return (
    <div className="relative mx-auto h-[420px] max-w-lg overflow-hidden rounded-3xl bg-gradient-to-b from-lavender/60 to-primary/40">
      <p className="absolute top-4 w-full text-center text-sm font-bold text-muted-foreground">
        Breath {round} of {rounds}
      </p>
      <div className="absolute inset-0 grid place-items-center">
        <motion.div
          className="grid place-items-center rounded-full border-4 border-card/80 bg-card/40 shadow-xl backdrop-blur"
          animate={{ width: phase === "out" ? 110 : 230, height: phase === "out" ? 110 : 230 }}
          transition={{ duration: secs, ease: "easeInOut" }}
        >
          <span className="px-4 text-center font-display text-xl font-bold">{label}</span>
        </motion.div>
      </div>
      <AnimatePresence>
        {bubbles.map((b) => (
          <motion.button
            key={b.id}
            aria-label="Pop bubble"
            className="absolute bottom-0 size-12 rounded-full border-2 border-card bg-card/40"
            style={{ left: `${b.x}%` }}
            initial={{ y: 0, opacity: 0.9 }}
            animate={{ y: -440, opacity: 0.6 }}
            exit={{ scale: 1.6, opacity: 0 }}
            transition={{ duration: 6, ease: "linear" }}
            onClick={() => {
              setPopped((p) => p + 1);
              setBubbles((bs) => bs.filter((x) => x.id !== b.id));
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

// ================================================================= 3. Colour Calm
const palettes = [
  "#F4A6A6",
  "#F7C873",
  "#F9E79F",
  "#A8D5BA",
  "#8CC5E6",
  "#B9A7E8",
  "#F2B5D4",
  "#C9A27E",
  "#7FB8A4",
  "#FFFFFF",
  "#5E6472",
  "#E8875C",
];

const pictures: Record<Difficulty, { name: string; shapes: string[] }> = {
  easy: {
    name: "Happy flower",
    shapes: [
      "M0 0H300V300H0Z",
      "M150 150m-30 0a30 30 0 1 0 60 0a30 30 0 1 0 -60 0",
      "M150 120 C120 60 180 60 150 120Z",
      "M180 150 C240 120 240 180 180 150Z",
      "M150 180 C180 240 120 240 150 180Z",
      "M120 150 C60 180 60 120 120 150Z",
      "M145 180 L155 180 L155 290 L145 290Z",
      "M150 250 C190 220 220 240 200 250 C180 260 160 255 150 250Z",
      "M0 270H300V300H0Z",
    ],
  },
  medium: {
    name: "Quiet house",
    shapes: [
      "M0 0H300V300H0Z",
      "M240 50m-25 0a25 25 0 1 0 50 0a25 25 0 1 0 -50 0",
      "M70 140 L150 70 L230 140Z",
      "M85 140H215V250H85Z",
      "M135 190H165V250H135Z",
      "M100 160H125V185H100Z",
      "M175 160H200V185H175Z",
      "M0 250H300V300H0Z",
      "M30 250 C30 200 60 200 60 250Z",
      "M250 250 C250 190 285 190 285 250Z",
      "M20 60 C40 40 80 40 95 60 C80 75 40 75 20 60Z",
    ],
  },
  hard: {
    name: "Calm mandala",
    shapes: [
      "M0 0H300V300H0Z",
      "M150 150m-130 0a130 130 0 1 0 260 0a130 130 0 1 0 -260 0",
      ...Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4;
        const x = 150 + Math.cos(a) * 85;
        const y = 150 + Math.sin(a) * 85;
        return `M${x} ${y}m-28 0a28 28 0 1 0 56 0a28 28 0 1 0 -56 0`;
      }),
      "M150 150m-60 0a60 60 0 1 0 120 0a60 60 0 1 0 -120 0",
      ...Array.from({ length: 6 }, (_, i) => {
        const a = (i * Math.PI) / 3;
        return `M150 150 L${150 + Math.cos(a) * 55} ${150 + Math.sin(a) * 55} L${150 + Math.cos(a + 0.5) * 55} ${150 + Math.sin(a + 0.5) * 55}Z`;
      }),
      "M150 150m-18 0a18 18 0 1 0 36 0a18 18 0 1 0 -36 0",
    ],
  },
};

export function ColouringGame({ difficulty, onFinish }: GameProps) {
  const pic = pictures[difficulty];
  const [fills, setFills] = useState<string[]>(() => pic.shapes.map(() => "#FFFFFF"));
  const [color, setColor] = useState(palettes[3]!);
  const svgRef = useRef<SVGSVGElement>(null);

  const finish = async () => {
    let drawing: string | undefined;
    try {
      const svg = new XMLSerializer().serializeToString(svgRef.current!);
      const img = new Image();
      img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = 600;
      canvas.height = 600;
      canvas.getContext("2d")!.drawImage(img, 0, 0, 600, 600);
      drawing = canvas.toDataURL("image/png");
    } catch {
      /* drawing export is optional */
    }
    onFinish(0, `You coloured "${pic.name}".`, drawing ? { drawing } : undefined);
  };

  return (
    <div className="mx-auto max-w-lg">
      <svg
        ref={svgRef}
        viewBox="0 0 300 300"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full rounded-3xl border-2 border-ink bg-card"
        role="img"
        aria-label={`Colouring picture: ${pic.name}`}
      >
        {pic.shapes.map((d, i) => (
          <path
            key={i}
            d={d}
            fill={fills[i]}
            stroke="#1A1917"
            strokeWidth={2}
            className="cursor-pointer"
            onClick={() => setFills((f) => f.map((x, j) => (j === i ? color : x)))}
          />
        ))}
      </svg>
      <div
        className="mt-4 flex flex-wrap justify-center gap-2"
        role="radiogroup"
        aria-label="Colours"
      >
        {palettes.map((p) => (
          <button
            key={p}
            role="radio"
            aria-checked={color === p}
            aria-label={`Colour ${p}`}
            onClick={() => setColor(p)}
            className={cn(
              "size-10 rounded-full border-2 border-ink transition-transform",
              color === p && "scale-125 ring-4 ring-ring",
            )}
            style={{ background: p }}
          />
        ))}
      </div>
      <div className="mt-5 flex justify-center gap-2">
        <PillButton variant="outline" onClick={() => setFills(pic.shapes.map(() => "#FFFFFF"))}>
          Start over
        </PillButton>
        <PillButton variant="forest" onClick={() => void finish()}>
          I'm done
        </PillButton>
      </div>
    </div>
  );
}

// ================================================================= 4. Feeling Faces
const scenarios: {
  text: string;
  young?: boolean;
  options: [string, string][];
  best: number;
  why: string;
}[] = [
  {
    text: "Mia's ice cream fell on the ground.",
    young: true,
    options: [
      ["😢", "Sad"],
      ["😄", "Happy"],
      ["😴", "Sleepy"],
    ],
    best: 0,
    why: "Losing something you were enjoying often feels sad — and maybe a little cross too.",
  },
  {
    text: "Leo got a birthday present he really wanted.",
    young: true,
    options: [
      ["😠", "Angry"],
      ["🤩", "Excited"],
      ["😨", "Scared"],
    ],
    best: 1,
    why: "Getting something you hoped for can feel exciting and happy.",
  },
  {
    text: "There was a loud thunderstorm at night.",
    young: true,
    options: [
      ["😨", "Scared"],
      ["😂", "Silly"],
      ["😌", "Calm"],
    ],
    best: 0,
    why: "Loud, sudden noises in the dark can feel scary. A cuddle or a slow breath can help.",
  },
  {
    text: "Sam's friend wouldn't share the swing.",
    young: true,
    options: [
      ["😤", "Frustrated"],
      ["😊", "Proud"],
      ["🥱", "Bored"],
    ],
    best: 0,
    why: "When things feel unfair, frustration is a very normal feeling.",
  },
  {
    text: "Ava finished a puzzle all by herself.",
    young: true,
    options: [
      ["😔", "Sad"],
      ["😊", "Proud"],
      ["😰", "Worried"],
    ],
    best: 1,
    why: "Doing something hard by yourself can feel proud.",
  },
  {
    text: "Noah has a test tomorrow and keeps thinking about it.",
    options: [
      ["😰", "Nervous"],
      ["🥳", "Celebrating"],
      ["😴", "Tired"],
    ],
    best: 0,
    why: "Thinking about something again and again before it happens is often nervousness. It shows you care.",
  },
  {
    text: "Priya wasn't invited to a party everyone is talking about.",
    options: [
      ["😞", "Left out"],
      ["😄", "Glad"],
      ["😲", "Surprised"],
    ],
    best: 0,
    why: "Feeling left out hurts. It can help to talk to someone you trust about it.",
  },
  {
    text: "Jay said something embarrassing in class and people laughed.",
    options: [
      ["😳", "Embarrassed"],
      ["😎", "Confident"],
      ["😋", "Hungry"],
    ],
    best: 0,
    why: "Embarrassment feels big in the moment but usually fades faster than we expect.",
  },
  {
    text: "Zara's grandpa is in hospital.",
    options: [
      ["😟", "Worried"],
      ["🤪", "Silly"],
      ["😐", "Nothing"],
    ],
    best: 0,
    why: "Worrying about someone we love is natural. Sadness can be there too.",
  },
  {
    text: "Ben has so much homework he doesn't know where to start.",
    options: [
      ["😵", "Overwhelmed"],
      ["😁", "Delighted"],
      ["😌", "Relaxed"],
    ],
    best: 0,
    why: "Too much at once can feel overwhelming. Breaking it into one small step helps.",
  },
];

export function EmotionsGame({ young, onFinish }: GameProps) {
  const list = useMemo(
    () => shuffle(scenarios.filter((s) => (young ? s.young : true))).slice(0, young ? 5 : 8),
    [young],
  );
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [right, setRight] = useState(0);
  const s = list[i]!;
  return (
    <div className="mx-auto max-w-lg text-center">
      <p className="text-sm font-bold text-muted-foreground">
        Story {i + 1} of {list.length}
      </p>
      <p className="mt-3 font-display text-2xl font-bold">{s.text}</p>
      <p className="mt-1 text-muted-foreground">How might they feel?</p>
      <div className="mt-6 grid grid-cols-3 gap-3">
        {s.options.map(([emoji, label], k) => (
          <button
            key={label}
            disabled={picked !== null}
            onClick={() => {
              setPicked(k);
              if (k === s.best) setRight((r) => r + 1);
            }}
            className={cn(
              "flex flex-col items-center gap-1 rounded-3xl border-2 p-4 text-lg font-bold transition-transform",
              picked === null
                ? "border-border bg-card hover:scale-105"
                : k === s.best
                  ? "border-forest bg-primary"
                  : picked === k
                    ? "border-ink bg-mustard"
                    : "border-border bg-card opacity-60",
            )}
          >
            <span className="text-5xl" aria-hidden="true">
              {emoji}
            </span>
            {label}
          </button>
        ))}
      </div>
      {picked !== null && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-5 rounded-2xl bg-lavender/60 p-4 text-left"
        >
          <p className="font-bold">
            {picked === s.best ? "Yes! 🌟" : "That could be part of it too 💛"}
          </p>
          <p className="mt-1 text-sm">{s.why}</p>
          <PillButton
            variant="forest"
            className="mt-3"
            onClick={() => {
              if (i + 1 >= list.length)
                onFinish(right, `You thought about ${list.length} feelings.`);
              else {
                setI(i + 1);
                setPicked(null);
              }
            }}
          >
            {i + 1 >= list.length ? "Finish" : "Next story"}
          </PillButton>
        </motion.div>
      )}
    </div>
  );
}

// ================================================================= 5. Slide Puzzle
export function PuzzleGame({ difficulty, young, onFinish }: GameProps) {
  const n = difficulty === "hard" && !young ? 4 : 3;
  const solved = useMemo(() => [...Array.from({ length: n * n - 1 }, (_, i) => i + 1), 0], [n]);
  const [tiles, setTiles] = useState<number[]>(() => {
    let t = [...solved];
    let empty = t.length - 1;
    const steps = young ? 20 : difficulty === "easy" ? 30 : difficulty === "medium" ? 80 : 150;
    for (let s = 0; s < steps; s++) {
      const r = Math.floor(empty / n);
      const c = empty % n;
      const opts = [
        r > 0 && empty - n,
        r < n - 1 && empty + n,
        c > 0 && empty - 1,
        c < n - 1 && empty + 1,
      ].filter((x): x is number => x !== false);
      const pick = opts[Math.floor(Math.random() * opts.length)]!;
      [t[empty], t[pick]] = [t[pick]!, t[empty]!];
      empty = pick;
    }
    if (t.every((v, i) => v === solved[i]))
      t = [...solved.slice(0, -3), solved[n * n - 2]!, solved[n * n - 3]!, 0];
    return t;
  });
  const [moves, setMoves] = useState(0);
  const done = tiles.every((v, i) => v === solved[i]);
  const secs = useSeconds(!done);
  useEffect(() => {
    if (done && moves > 0)
      setTimeout(
        () =>
          onFinish(
            Math.max(10, 1000 - moves * 4 - secs * 2),
            `Solved in ${moves} moves and ${secs}s.`,
          ),
        500,
      );
  }, [done, moves, secs, onFinish]);
  const move = (i: number) => {
    const e = tiles.indexOf(0);
    const adj =
      (Math.abs(i - e) === 1 && Math.floor(i / n) === Math.floor(e / n)) || Math.abs(i - e) === n;
    if (!adj || done) return;
    const t = [...tiles];
    [t[i], t[e]] = [t[e]!, t[i]!];
    setTiles(t);
    setMoves((m) => m + 1);
  };
  const colors = ["bg-primary", "bg-lavender", "bg-blush", "bg-mustard"];
  return (
    <div className="mx-auto max-w-sm">
      <p className="mb-3 text-center text-sm font-bold text-muted-foreground">
        Moves {moves} · {secs}s
      </p>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
        {tiles.map((v, i) =>
          v === 0 ? (
            <div
              key="empty"
              className="aspect-square rounded-2xl border-2 border-dashed border-border"
            />
          ) : (
            <motion.button
              layout
              key={v}
              onClick={() => move(i)}
              className={cn(
                "aspect-square rounded-2xl border-2 border-ink font-display text-3xl font-black",
                colors[v % 4],
              )}
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
              aria-label={`Tile ${v}`}
            >
              {v}
            </motion.button>
          ),
        )}
      </div>
    </div>
  );
}

// ================================================================= 6. Firefly Focus
export function FocusGame({ difficulty, onFinish }: GameProps) {
  const size = difficulty === "hard" ? 5 : 4;
  const rounds = 20;
  const window = difficulty === "easy" ? 1500 : difficulty === "medium" ? 1100 : 850;
  const [round, setRound] = useState(0);
  const [target, setTarget] = useState(-1);
  const [decoys, setDecoys] = useState<number[]>([]);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [flash, setFlash] = useState<"hit" | "miss" | null>(null);

  const next = useCallback(() => {
    setRound((r) => r + 1);
    const cells = size * size;
    const t = Math.floor(Math.random() * cells);
    setTarget(t);
    const nDecoys = difficulty === "easy" ? 0 : difficulty === "medium" ? 2 : 4;
    setDecoys(
      shuffle(Array.from({ length: cells }, (_, i) => i).filter((i) => i !== t)).slice(0, nDecoys),
    );
  }, [size, difficulty]);

  useEffect(() => {
    if (round === 0) {
      const t = setTimeout(next, 800);
      return () => clearTimeout(t);
    }
    if (round > rounds) {
      onFinish(Math.max(0, hits * 10 - misses * 5), `${hits} fireflies caught, ${misses} missed.`);
      return;
    }
    const t = setTimeout(() => {
      setMisses((m) => m + 1);
      setTarget(-1);
      setTimeout(next, 350);
    }, window);
    return () => clearTimeout(t);
  }, [round]); // eslint-disable-line react-hooks/exhaustive-deps

  const tap = (i: number) => {
    if (target < 0) return;
    if (i === target) {
      setHits((h) => h + 1);
      setFlash("hit");
    } else {
      setMisses((m) => m + 1);
      setFlash("miss");
    }
    setTarget(-1);
    setTimeout(() => setFlash(null), 200);
    setTimeout(next, 350);
  };

  return (
    <div className="mx-auto max-w-md">
      <p className="mb-3 text-center text-sm font-bold text-muted-foreground">
        Round {Math.min(round, rounds)}/{rounds} · caught {hits}
      </p>
      <div
        className={cn(
          "grid gap-2 rounded-3xl bg-[oklch(0.25_0.04_260)] p-3 transition-colors",
          flash === "miss" && "bg-[oklch(0.3_0.06_20)]",
        )}
        style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
      >
        {Array.from({ length: size * size }, (_, i) => (
          <button
            key={i}
            onClick={() => tap(i)}
            className="grid aspect-square place-items-center rounded-2xl bg-white/5"
            aria-label={i === target ? "Firefly" : "Dark spot"}
          >
            {i === target && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: [1, 1.25, 1] }}
                transition={{ repeat: Infinity, duration: 0.6 }}
                className="size-6 rounded-full bg-[oklch(0.92_0.18_100)] shadow-[0_0_24px_8px_oklch(0.92_0.18_100/60%)]"
              />
            )}
            {decoys.includes(i) && target >= 0 && (
              <span className="size-5 rounded-full bg-[oklch(0.7_0.12_200)] opacity-70" />
            )}
          </button>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Tap only the yellow firefly. Blue lights are distractions — let them pass.
      </p>
    </div>
  );
}

// ================================================================= 7. Leaf Catch (reaction)
export function ReactionGame({ difficulty, onFinish }: GameProps) {
  const rounds = difficulty === "easy" ? 3 : difficulty === "medium" ? 5 : 7;
  const [state, setState] = useState<"wait" | "ready" | "go" | "early">("wait");
  const [times, setTimes] = useState<number[]>([]);
  const goAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const arm = useCallback(() => {
    setState("ready");
    timer.current = setTimeout(
      () => {
        goAt.current = performance.now();
        setState("go");
      },
      1200 + Math.random() * (difficulty === "hard" ? 3500 : 2500),
    );
  }, [difficulty]);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const tap = () => {
    if (state === "wait" || state === "early") return arm();
    if (state === "ready") {
      if (timer.current) clearTimeout(timer.current);
      setState("early");
      return;
    }
    const ms = Math.round(performance.now() - goAt.current);
    const next = [...times, ms];
    setTimes(next);
    if (next.length >= rounds) {
      const avg = Math.round(next.reduce((a, b) => a + b, 0) / next.length);
      onFinish(Math.max(0, 1000 - avg), `Average ${avg} ms over ${rounds} leaves.`);
    } else setState("wait");
  };

  const bg =
    state === "go"
      ? "bg-[oklch(0.75_0.18_145)]"
      : state === "early"
        ? "bg-coral"
        : state === "ready"
          ? "bg-[oklch(0.75_0.12_60)]"
          : "bg-muted";
  return (
    <button
      onClick={tap}
      className={cn(
        "mx-auto grid h-80 w-full max-w-lg place-items-center rounded-3xl border-2 border-ink transition-colors",
        bg,
      )}
    >
      <span className="text-center">
        <span className="block text-7xl" aria-hidden="true">
          {state === "go" ? "🍃" : state === "early" ? "🍂" : "🍁"}
        </span>
        <span className="mt-3 block font-display text-2xl font-bold">
          {state === "wait" &&
            (times.length
              ? `${times[times.length - 1]} ms — tap for the next leaf`
              : "Tap to start")}
          {state === "ready" && "Wait for green…"}
          {state === "go" && "Tap!"}
          {state === "early" && "Too soon — that's okay. Tap to try again."}
        </span>
        <span className="mt-1 block text-sm font-bold text-muted-foreground">
          Leaf {Math.min(times.length + 1, rounds)} of {rounds}
        </span>
      </span>
    </button>
  );
}

// ================================================================= 8. Rhythm Breeze
export function RhythmGame({ difficulty, onFinish }: GameProps) {
  const beats = 24;
  const tolerance = difficulty === "easy" ? 180 : difficulty === "medium" ? 130 : 90;
  const [beat, setBeat] = useState(0);
  const [started, setStarted] = useState(false);
  const [hits, setHits] = useState(0);
  const [feedback, setFeedback] = useState("");
  const last = useRef(0);
  const interval = useRef(800);
  const ctx = useRef<AudioContext | null>(null);
  const tapped = useRef(false);

  useEffect(() => {
    if (!started) return;
    if (beat >= beats) {
      onFinish(Math.round((hits / beats) * 1000), `${hits} of ${beats} beats in time.`);
      return;
    }
    const t = setTimeout(() => {
      last.current = performance.now();
      tapped.current = false;
      interval.current = 800 + (beat / beats) * 500; // gently slows down
      try {
        const a = ctx.current!;
        const o = a.createOscillator();
        const g = a.createGain();
        o.frequency.value = beat % 4 === 0 ? 520 : 392;
        g.gain.setValueAtTime(0.15, a.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.25);
        o.connect(g).connect(a.destination);
        o.start();
        o.stop(a.currentTime + 0.25);
      } catch {
        /* sound optional */
      }
      setBeat((b) => b + 1);
    }, interval.current);
    return () => clearTimeout(t);
  }, [beat, started]); // eslint-disable-line react-hooks/exhaustive-deps

  const tap = () => {
    if (!started) {
      try {
        ctx.current = new AudioContext();
      } catch {
        /* no audio */
      }
      setStarted(true);
      return;
    }
    if (tapped.current) return;
    const now = performance.now();
    const off = Math.min(
      Math.abs(now - last.current),
      Math.abs(now - (last.current + interval.current)),
    );
    tapped.current = true;
    if (off <= tolerance) {
      setHits((h) => h + 1);
      setFeedback(off < tolerance / 2 ? "Perfect 🌟" : "Nice 🎵");
    } else setFeedback("Breathe and find the beat");
  };

  return (
    <div className="mx-auto max-w-md text-center">
      <button
        onClick={tap}
        className="relative mx-auto grid size-72 place-items-center rounded-full border-2 border-ink bg-gradient-to-br from-lavender to-blush"
        aria-label={started ? "Tap in time" : "Start"}
      >
        <motion.span
          key={beat}
          className="absolute inset-6 rounded-full border-4 border-card"
          initial={{ scale: 1, opacity: 0.9 }}
          animate={{ scale: 0.5, opacity: 0 }}
          transition={{ duration: interval.current / 1000 }}
        />
        <span className="font-display text-3xl font-black">
          {started ? `${beat}/${beats}` : "Tap to start"}
        </span>
      </button>
      <p className="mt-4 h-6 font-bold">{feedback}</p>
      <p className="text-sm text-muted-foreground">
        Tap whenever you hear the beat. It slows down as you go.
      </p>
    </div>
  );
}

// ================================================================= 9. Kind Words
const wordBank: Record<Difficulty, [string, string][]> = {
  easy: [
    ["CALM", "When did you last feel calm?"],
    ["KIND", "Who was kind to you recently?"],
    ["HOPE", "What's one small thing you're hoping for?"],
    ["REST", "What does real rest look like for you?"],
    ["SAFE", "Where do you feel safest?"],
  ],
  medium: [
    ["BREATHE", "Take one slow breath before the next word."],
    ["GENTLE", "How could you be gentler with yourself today?"],
    ["STEADY", "What helps you feel steady?"],
    ["GRATEFUL", "Name one thing you're grateful for right now."],
    ["PATIENT", "Where could a little patience help this week?"],
  ],
  hard: [
    ["RESILIENCE", "Think of a time you bounced back."],
    ["COMPASSION", "What would you say to a friend feeling how you feel?"],
    ["BELONGING", "Where do you feel you belong?"],
    ["MINDFULNESS", "Notice three sounds around you right now."],
    ["COURAGEOUS", "What's one brave thing you've done lately?"],
  ],
};

export function WordsGame({ difficulty, onFinish }: GameProps) {
  const list = useMemo(() => shuffle(wordBank[difficulty]).slice(0, 4), [difficulty]);
  const [i, setI] = useState(0);
  const [letters, setLetters] = useState(() =>
    shuffle(list[0]![0].split("").map((l, k) => ({ l, k }))),
  );
  const [picked, setPicked] = useState<number[]>([]);
  const [solved, setSolved] = useState(false);
  const [score, setScore] = useState(0);
  const [hints, setHints] = useState(0);
  const [word, prompt] = list[i]!;
  const guess = picked.map((k) => letters.find((x) => x.k === k)!.l).join("");

  useEffect(() => {
    if (guess.length === word.length) {
      if (guess === word) {
        setSolved(true);
        setScore((s) => s + 100);
      } else setTimeout(() => setPicked([]), 500);
    }
  }, [guess, word]);

  return (
    <div className="mx-auto max-w-lg text-center">
      <p className="text-sm font-bold text-muted-foreground">
        Word {i + 1} of {list.length}
      </p>
      <div className="mt-4 flex min-h-14 flex-wrap justify-center gap-1.5">
        {word.split("").map((_, k) => (
          <span
            key={k}
            className={cn(
              "grid size-11 place-items-center rounded-xl border-2 font-display text-2xl font-black",
              solved ? "border-forest bg-primary" : "border-ink bg-card",
            )}
          >
            {guess[k] ?? ""}
          </span>
        ))}
      </div>
      {!solved ? (
        <>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {letters.map(({ l, k }) => (
              <button
                key={k}
                disabled={picked.includes(k)}
                onClick={() => setPicked((p) => [...p, k])}
                className="grid size-12 place-items-center rounded-2xl border-2 border-ink bg-mustard font-display text-2xl font-black disabled:opacity-25"
              >
                {l}
              </button>
            ))}
          </div>
          <div className="mt-4 flex justify-center gap-2">
            <PillButton variant="outline" onClick={() => setPicked((p) => p.slice(0, -1))}>
              Undo
            </PillButton>
            <PillButton
              variant="ghost"
              onClick={() => {
                setHints((h) => h + 1);
                setScore((s) => s - 20);
                const needed = word[guess.length];
                const k = letters.find((x) => x.l === needed && !picked.includes(x.k));
                if (k) setPicked((p) => [...p, k.k]);
              }}
            >
              Hint
            </PillButton>
          </div>
        </>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-6 rounded-3xl bg-lavender/60 p-5"
        >
          <p className="font-display text-xl font-bold">{prompt}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Take a moment with it. No need to answer out loud.
          </p>
          <PillButton
            variant="forest"
            className="mt-4"
            onClick={() => {
              if (i + 1 >= list.length)
                onFinish(Math.max(0, score), `${list.length} kind words, ${hints} hints.`);
              else {
                setI(i + 1);
                setLetters(shuffle(list[i + 1]![0].split("").map((l, k) => ({ l, k }))));
                setPicked([]);
                setSolved(false);
              }
            }}
          >
            {i + 1 >= list.length ? "Finish" : "Next word"}
          </PillButton>
        </motion.div>
      )}
    </div>
  );
}

// ================================================================= 10. Calm Quest
type Scene = { text: string; emoji: string; exercise?: string; choices: [string, string][] };
const quest: Record<string, Scene> = {
  start: {
    emoji: "🌲",
    text: "You step into a quiet forest. Sunlight drips through the leaves. Two paths curl ahead.",
    choices: [
      ["Follow the sound of water", "stream"],
      ["Take the mossy path uphill", "hill"],
    ],
  },
  stream: {
    emoji: "🏞️",
    text: "A clear stream bubbles over smooth stones. You sit on a warm rock.",
    exercise:
      "Watch the water for three slow breaths. Breathe in as a ripple forms… out as it drifts away.",
    choices: [
      ["Float a leaf down the stream", "leaf"],
      ["Cross the stepping stones", "stones"],
    ],
  },
  hill: {
    emoji: "⛰️",
    text: "The path climbs gently. At the top, the whole valley is spread out below you.",
    exercise: "Notice five things you can see from up here, one at a time.",
    choices: [
      ["Rest under the old oak", "oak"],
      ["Wave to the clouds", "clouds"],
    ],
  },
  leaf: {
    emoji: "🍃",
    text: "You place a worry on a leaf and set it on the water. It bobs, turns, and floats away around the bend.",
    exercise: "Think of one small worry. Imagine it on the leaf. Let the stream carry it for now.",
    choices: [["Walk on to the meadow", "meadow"]],
  },
  stones: {
    emoji: "🪨",
    text: "Step… step… step. Each stone is solid under your feet.",
    exercise: "Press your feet into the floor where you are. Feel how steady the ground is.",
    choices: [["Walk on to the meadow", "meadow"]],
  },
  oak: {
    emoji: "🌳",
    text: "The oak's trunk is wide and rough. Its roots go deep. You lean back against it.",
    exercise: "Drop your shoulders. Unclench your jaw. Let the tree hold you up for three breaths.",
    choices: [["Walk down to the meadow", "meadow"]],
  },
  clouds: {
    emoji: "☁️",
    text: "The clouds drift by, changing shape — a rabbit, a boat, a sleeping cat.",
    exercise: "Feelings are a bit like clouds — they come and they move on. Let one pass by.",
    choices: [["Walk down to the meadow", "meadow"]],
  },
  meadow: {
    emoji: "🌼",
    text: "You reach a meadow full of wildflowers. Bees hum. A gentle breeze. This is your calm place, and you can come back any time.",
    exercise: "Breathe in the scent of the flowers for 4… hold for 2… breathe out for 6.",
    choices: [["Finish your quest", "end"]],
  },
};

export function AdventureGame({ onFinish }: GameProps) {
  const [id, setId] = useState("start");
  const [path, setPath] = useState<string[]>([]);
  const s = quest[id]!;
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={id}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        className="mx-auto max-w-lg rounded-3xl bg-gradient-to-b from-primary/50 to-lavender/50 p-6 text-center"
      >
        <p className="float-slow text-7xl" aria-hidden="true">
          {s.emoji}
        </p>
        <p className="mt-4 font-display text-xl leading-relaxed font-bold">{s.text}</p>
        {s.exercise && (
          <p className="mt-4 rounded-2xl bg-card/80 p-4 text-sm font-semibold">🫧 {s.exercise}</p>
        )}
        <div className="mt-6 grid gap-2">
          {s.choices.map(([label, to]) => (
            <PillButton
              key={to}
              variant="outline"
              onClick={() => {
                if (to === "end")
                  onFinish(0, `You walked ${path.length + 1} calm steps through the forest.`);
                else {
                  setPath((p) => [...p, id]);
                  setId(to);
                }
              }}
            >
              {label}
            </PillButton>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export const gameComponents: Record<string, (p: GameProps) => React.ReactElement> = {
  memory: MemoryGame,
  bubbles: BubblesGame,
  colouring: ColouringGame,
  emotions: EmotionsGame,
  puzzle: PuzzleGame,
  focus: FocusGame,
  reaction: ReactionGame,
  rhythm: RhythmGame,
  words: WordsGame,
  adventure: AdventureGame,
};
