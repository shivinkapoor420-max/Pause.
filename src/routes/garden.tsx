import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, CalmToggle, PillButton } from "@/components/app-shell";
import { CornerBotanicals } from "@/components/illustrations";
import { buildGarden, type GardenItem } from "@/lib/garden";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { daysUsing } from "@/lib/insights";
import { useApp } from "@/lib/app-state";

export const Route = createFileRoute("/garden")({
  head: () => ({
    meta: [
      { title: "Your growth garden — Pause." },
      {
        name: "description",
        content:
          "An illustrated garden that grows slowly over months of check-ins, journal entries and coping tools. It only ever grows.",
      },
      { property: "og:title", content: "Your growth garden — Pause." },
      {
        property: "og:description",
        content: "A keepsake of showing up, not a chart. Nothing wilts, nothing is lost for a gap.",
      },
    ],
  }),
  component: GardenPage,
});

function place(item: GardenItem) {
  const golden = 137.508;
  const angle = (item.n * golden) % 360;
  const radius = 6 + ((item.n * 7) % 38);
  const x = 50 + Math.cos((angle * Math.PI) / 180) * radius;
  const y = 68 + Math.sin((angle * Math.PI) / 180) * radius * 0.42;
  return { x, y, scale: 0.7 + ((item.n * 13) % 9) / 20 };
}

function Sprout({ item }: { item: GardenItem }) {
  const { x, y, scale } = place(item);
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {item.kind === "leaf" && (
        <path
          d="M0 0 C-1 -6 1 -10 4 -12 C4 -7 2 -2 0 0 Z M0 0 V-9"
          fill="color-mix(in oklch, var(--color-primary) 80%, transparent)"
          stroke="var(--color-forest)"
          strokeWidth="0.5"
        />
      )}
      {item.kind === "fern" && (
        <path
          d="M0 0 C-3 -6 -2 -12 0 -16 M0 -4 l-3 -2 M0 -8 l3 -2 M0 -12 l-3 -2"
          fill="none"
          stroke="var(--color-forest)"
          strokeWidth="0.6"
          strokeLinecap="round"
        />
      )}
      {item.kind === "flower" && (
        <g>
          <path d="M0 0 V-9" stroke="var(--color-forest)" strokeWidth="0.6" />
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse
              key={a}
              cx="0"
              cy="-12"
              rx="1.5"
              ry="3"
              transform={`rotate(${a} 0 -9)`}
              fill="color-mix(in oklch, var(--color-blush) 85%, transparent)"
              stroke="var(--color-ink)"
              strokeWidth="0.3"
            />
          ))}
          <circle cx="0" cy="-9" r="1.4" fill="var(--color-mustard)" />
        </g>
      )}
      {item.kind === "stone" && (
        <ellipse
          cx="0"
          cy="-1"
          rx="3.4"
          ry="2.1"
          fill="color-mix(in oklch, var(--color-lavender) 80%, transparent)"
          stroke="var(--color-ink)"
          strokeWidth="0.4"
        />
      )}
      {item.kind === "bird" && (
        <path
          d="M-4 -18 q2 -2 4 0 q2 -2 4 0"
          fill="none"
          stroke="var(--color-ink)"
          strokeWidth="0.5"
          strokeLinecap="round"
        />
      )}
    </g>
  );
}

export const scenes = {
  meadow: {
    label: "Meadow",
    sky: "color-mix(in oklch, var(--color-background) 70%, var(--color-card))",
    ground: "color-mix(in oklch, var(--color-forest) 16%, transparent)",
    level: 1,
  },
  dawn: {
    label: "Dawn",
    sky: "oklch(0.93 0.05 40)",
    ground: "oklch(0.8 0.08 140 / 45%)",
    level: 2,
  },
  seaside: {
    label: "Seaside",
    sky: "oklch(0.92 0.05 220)",
    ground: "oklch(0.88 0.07 85 / 70%)",
    level: 3,
  },
  night: {
    label: "Starry night",
    sky: "oklch(0.32 0.06 270)",
    ground: "oklch(0.4 0.07 160 / 70%)",
    level: 5,
  },
} as const;

/** Collectibles unlock through levels and achievements — never through reporting a particular mood. */
export const decorations: {
  id: string;
  emoji: string;
  label: string;
  x: number;
  y: number;
  level?: number;
  achievement?: string;
}[] = [
  { id: "sun", emoji: "☀️", label: "Warm sun", x: 84, y: 14, level: 1 },
  { id: "bench", emoji: "🪑", label: "Resting bench", x: 18, y: 70, achievement: "first_checkin" },
  { id: "butterfly", emoji: "🦋", label: "Butterfly", x: 62, y: 40, achievement: "first_journal" },
  { id: "pond", emoji: "💧", label: "Little pond", x: 76, y: 80, achievement: "first_breath" },
  { id: "mushroom", emoji: "🍄", label: "Mushrooms", x: 30, y: 82, achievement: "first_game" },
  { id: "lantern", emoji: "🏮", label: "Lantern", x: 8, y: 62, level: 3 },
  { id: "rainbow", emoji: "🌈", label: "Rainbow", x: 40, y: 18, achievement: "checkin_7" },
  { id: "bee", emoji: "🐝", label: "Busy bee", x: 52, y: 56, achievement: "journal_10" },
  { id: "tree", emoji: "🌳", label: "Old oak", x: 90, y: 60, achievement: "checkin_30" },
  { id: "moon", emoji: "🌙", label: "Moon", x: 14, y: 14, level: 5 },
  { id: "snail", emoji: "🐌", label: "Patient snail", x: 66, y: 86, achievement: "breath_10" },
  { id: "kite", emoji: "🪁", label: "Kite", x: 70, y: 22, achievement: "games_5_kinds" },
];

type GardenPrefs = { scene?: keyof typeof scenes; decor?: string[] };

function GardenStudio({
  prefs,
  onChange,
}: {
  prefs: GardenPrefs;
  onChange: (p: GardenPrefs) => void;
}) {
  const ach = useQuery({
    queryKey: ["achievements"],
    queryFn: () =>
      api<{ level: number; achievements: { key: string; earnedAt: string | null }[] }>(
        "/achievements",
      ),
  });
  const level = ach.data?.level ?? 1;
  const earned = new Set(
    (ach.data?.achievements ?? []).filter((a) => a.earnedAt).map((a) => a.key),
  );
  const unlocked = (d: (typeof decorations)[number]) =>
    (d.level ? level >= d.level : true) && (d.achievement ? earned.has(d.achievement) : true);
  const decor = prefs.decor ?? [];
  return (
    <section className="card-soft mt-6 p-6">
      <h3 className="font-display text-2xl font-bold">Make it yours</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Unlock scenes and keepsakes by showing up — level {level} so far.
      </p>
      <p className="mt-4 text-sm font-bold">Scene</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {(Object.keys(scenes) as (keyof typeof scenes)[]).map((k) => {
          const locked = level < scenes[k].level;
          return (
            <button
              key={k}
              disabled={locked}
              onClick={() => onChange({ ...prefs, scene: k })}
              aria-pressed={(prefs.scene ?? "meadow") === k}
              className={`rounded-2xl border-2 px-3 py-2 text-sm font-bold disabled:opacity-50 ${(prefs.scene ?? "meadow") === k ? "border-ink" : "border-border"}`}
            >
              <span
                className="mr-2 inline-block size-4 rounded-full align-middle"
                style={{ background: scenes[k].sky }}
              />
              {scenes[k].label}
              {locked && ` · level ${scenes[k].level}`}
            </button>
          );
        })}
      </div>
      <p className="mt-5 text-sm font-bold">Keepsakes</p>
      <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {decorations.map((d) => {
          const ok = unlocked(d);
          const on = decor.includes(d.id);
          return (
            <button
              key={d.id}
              disabled={!ok}
              onClick={() =>
                onChange({
                  ...prefs,
                  decor: on ? decor.filter((x) => x !== d.id) : [...decor, d.id],
                })
              }
              aria-pressed={on}
              title={
                ok ? d.label : d.level ? `Reach level ${d.level}` : "Earn an achievement to unlock"
              }
              className={`flex flex-col items-center gap-1 rounded-2xl border-2 p-2 text-xs font-bold ${on ? "border-ink bg-primary/60" : "border-border bg-muted"} ${ok ? "" : "opacity-40 grayscale"}`}
            >
              <span className="text-2xl" aria-hidden="true">
                {ok ? d.emoji : "🔒"}
              </span>
              {d.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function GardenPage() {
  const { state, update } = useApp();
  const gPrefs = ((state as unknown as { garden?: GardenPrefs }).garden ?? {}) as GardenPrefs;
  const scene = scenes[gPrefs.scene ?? "meadow"] ?? scenes.meadow;
  const saveGarden = (next: GardenPrefs) => {
    update({ ...({ garden: next } as object) } as never);
    void api("/me", { method: "PATCH", body: { appData: { garden: next } } }).catch(() => {});
  };
  const garden = buildGarden(state);
  const counts = garden.items.reduce<Record<string, number>>((acc, i) => {
    acc[i.because] = (acc[i.because] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <AppShell title="Your growth garden">
      <CornerBotanicals corner="bottom-left" className="text-forest" data-decorative="true" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg font-bold text-forest">Growth garden</p>
          <h2 className="font-display text-4xl font-black tracking-tight">{garden.headline}</h2>
        </div>
        <CalmToggle />
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {daysUsing(state)} day{daysUsing(state) === 1 ? "" : "s"} in. {garden.note}
      </p>

      <div
        className="card-soft mt-6 w-full overflow-hidden"
        role="img"
        aria-label={`${garden.headline} ${garden.items.length} things have grown here.`}
      >
        <svg viewBox="0 0 100 92" className="mx-auto w-full max-w-xl">
          <rect width="100" height="92" fill={scene.sky} />
          <path d="M0 74 q16 -6 32 -1 t34 -3 t34 2 V92 H0 Z" fill={scene.ground} />
          <path
            d="M0 74 q16 -6 32 -1 t34 -3 t34 2"
            fill="none"
            stroke="var(--color-forest)"
            strokeWidth="0.6"
          />
          {garden.items.map((item) => (
            <Sprout key={item.n} item={item} />
          ))}
          {decorations
            .filter((d) => (gPrefs.decor ?? []).includes(d.id))
            .map((d) => (
              <text key={d.id} x={d.x} y={d.y} fontSize="7" textAnchor="middle">
                {d.emoji}
              </text>
            ))}
        </svg>
      </div>

      <GardenStudio prefs={gPrefs} onChange={saveGarden} />

      {garden.items.length > 0 && (
        <ul className="mt-5 grid gap-2">
          {Object.entries(counts).map(([because, n]) => (
            <li key={because} className="rounded-2xl bg-muted p-4 text-sm font-semibold">
              {n} for {because}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <Link to="/home">
          <PillButton variant="primary">Check in today</PillButton>
        </Link>
        <Link to="/weather">
          <PillButton variant="outline">Your inner weather</PillButton>
        </Link>
        <Link to="/grounding">
          <PillButton variant="outline">The Grounding Room</PillButton>
        </Link>
      </div>
    </AppShell>
  );
}
