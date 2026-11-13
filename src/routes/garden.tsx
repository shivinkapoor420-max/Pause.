import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, CalmToggle, PillButton } from "@/components/app-shell";
import { CornerBotanicals } from "@/components/illustrations";
import { buildGarden, type GardenItem } from "@/lib/garden";
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

function GardenPage() {
  const { state } = useApp();
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
        <svg viewBox="0 0 100 92" className="w-full">
          <rect
            width="100"
            height="92"
            fill="color-mix(in oklch, var(--color-background) 70%, var(--color-card))"
          />
          <path
            d="M0 74 q16 -6 32 -1 t34 -3 t34 2 V92 H0 Z"
            fill="color-mix(in oklch, var(--color-forest) 16%, transparent)"
          />
          <path
            d="M0 74 q16 -6 32 -1 t34 -3 t34 2"
            fill="none"
            stroke="var(--color-forest)"
            strokeWidth="0.6"
          />
          {garden.items.map((item) => (
            <Sprout key={item.n} item={item} />
          ))}
        </svg>
      </div>

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
