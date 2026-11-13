import type { Sky } from "@/lib/app-state";

const skyOrder: Sky[] = ["sunny", "partly", "cloudy", "rainy", "stormy"];

export const skyMeta: Record<Sky, { label: string; kidLabel: string }> = {
  sunny: { label: "Bright", kidLabel: "Happy" },
  partly: { label: "Mostly okay", kidLabel: "Okay" },
  cloudy: { label: "Flat or foggy", kidLabel: "Meh" },
  rainy: { label: "Low", kidLabel: "Sad" },
  stormy: { label: "Overwhelmed", kidLabel: "Too much" },
};

export const skyScale = skyOrder;

export function WeatherIcon({ sky, className = "" }: { sky: Sky; className?: string }) {
  const stroke = "currentColor";
  const common = { fill: "none", stroke, strokeWidth: 2.2, strokeLinecap: "round" as const };
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      {sky === "sunny" && (
        <g {...common}>
          <circle cx="24" cy="24" r="8" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <line
              key={a}
              x1={24 + 13 * Math.cos((a * Math.PI) / 180)}
              y1={24 + 13 * Math.sin((a * Math.PI) / 180)}
              x2={24 + 18 * Math.cos((a * Math.PI) / 180)}
              y2={24 + 18 * Math.sin((a * Math.PI) / 180)}
            />
          ))}
        </g>
      )}
      {sky === "partly" && (
        <g {...common}>
          <circle cx="31" cy="17" r="6" />
          <path d="M12 34c-3 0-5-2-5-5s2-5 5-5c0-4 3-7 7-7s7 3 7 7c3 0 5 2 5 5s-2 5-5 5z" />
        </g>
      )}
      {sky === "cloudy" && (
        <g {...common}>
          <path d="M14 33c-4 0-7-3-7-6s3-6 6-6c1-5 5-8 10-8s9 4 9 9c4 0 7 2 7 5.5S36 33 32 33z" />
        </g>
      )}
      {sky === "rainy" && (
        <g {...common}>
          <path d="M14 28c-4 0-7-3-7-6s3-6 6-6c1-5 5-8 10-8s9 4 9 9c4 0 7 2 7 5.5S36 28 32 28z" />
          <line x1="17" y1="33" x2="15" y2="39" />
          <line x1="25" y1="33" x2="23" y2="41" />
          <line x1="33" y1="33" x2="31" y2="39" />
        </g>
      )}
      {sky === "stormy" && (
        <g {...common}>
          <path d="M14 26c-4 0-7-3-7-6s3-6 6-6c1-5 5-8 10-8s9 4 9 9c4 0 7 2 7 5.5S36 26 32 26z" />
          <path d="M26 29l-8 7h6l-3 7 10-9h-6z" />
        </g>
      )}
    </svg>
  );
}

export function LeafSprig({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 60" className={className} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <path d="M10 52C22 44 34 30 44 10" />
        <path d="M22 40c-6-2-9-7-9-12 6 0 11 4 12 10" />
        <path d="M30 30c-2-6 0-12 4-15 3 5 3 11-1 15" />
        <path d="M36 20c4-3 10-3 14-1-3 5-9 7-14 5" />
      </g>
    </svg>
  );
}

export function HandsIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 80" className={className} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
        <path d="M6 62c10-4 18-10 24-18 3-4 8-4 10 0 2 4 0 8-4 11" />
        <path d="M22 44c4-6 10-8 15-6" />
        <path d="M114 18c-10 4-18 10-24 18-3 4-8 4-10 0-2-4 0-8 4-11" />
        <path d="M98 36c-4 6-10 8-15 6" />
        <path d="M52 40h16" />
        <circle cx="60" cy="40" r="3.5" />
      </g>
    </svg>
  );
}

export function BrainBulb({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 90" className={className} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
        <path d="M34 70c-12 0-22-10-22-22 0-6 2-11 6-15-2-9 5-17 14-17 4-5 12-6 17-2 10-3 20 4 20 15 6 4 9 11 9 19 0 12-10 22-22 22z" />
        <path d="M40 70v10h20V70" />
        <path d="M44 84h12" />
        <path d="M50 30v22M50 38l-8-6M50 46l9-7" />
      </g>
    </svg>
  );
}

/**
 * Decorative botanical line-art anchored to a screen corner. Purely ambient —
 * never carries meaning, never interactive.
 */
export function CornerBotanicals({
  corner = "top-right",
  className = "",
}: {
  corner?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  className?: string;
}) {
  const place: Record<string, string> = {
    "top-left": "left-0 top-0",
    "top-right": "right-0 top-0 -scale-x-100",
    "bottom-left": "bottom-0 left-0 -scale-y-100",
    "bottom-right": "bottom-0 right-0 rotate-180",
  };
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute -z-10 ${place[corner]} ${className}`}
    >
      <svg viewBox="0 0 180 180" className="size-40 opacity-45 sway sm:size-56">
        <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M-4 8C34 14 66 38 88 74" />
          <path d="M18 12c10 8 12 20 8 30-10-4-16-16-14-27" />
          <path d="M44 30c12 5 18 16 17 27-11-2-20-12-22-24" />
          <path d="M70 56c12 3 20 13 21 25-12-1-22-10-25-22" />
          <path d="M8 34c-2 14 4 26 14 32 3-12-2-25-11-33" />
          <path d="M32 62c-1 13 6 24 16 29 2-12-4-24-14-30" />
          <circle cx="104" cy="96" r="4" />
          <path d="M120 22c14-2 26 4 32 14-13 4-27-2-33-13" />
        </g>
      </svg>
    </div>
  );
}

/** Onboarding scene: the brain-and-bulb idea, with the faintest pulse. */
export function IdeaScene({ className = "" }: { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <span className="absolute left-1/2 top-6 -z-10 size-24 -translate-x-1/2 rounded-full bg-mustard/50 blur-2xl glow-slow" />
      <svg viewBox="0 0 220 150" className="w-full" aria-hidden="true">
        <g fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M76 118c-22 0-40-18-40-40 0-11 4-20 11-27-4-16 9-31 26-31 7-9 22-11 31-4 18-5 36 8 36 27 11 7 17 20 17 35 0 22-18 40-40 40z" />
          <path d="M92 118v14h36v-14M98 138h24" />
          <g className="flicker">
            <path d="M110 52v34M110 64l-14-11M110 76l16-13" />
            <circle cx="110" cy="46" r="6" />
          </g>
          <path d="M186 40c8-4 17-3 22 1-5 6-14 7-22 3" />
          <path d="M20 108c-8-4-13-12-13-20 8 1 15 8 17 17" />
        </g>
      </svg>
    </div>
  );
}

/** Patterns intro scene: emotional weather gathering over a horizon. */
export function WeatherSceneIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 120" className={className} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <path d="M4 104h232" />
        <path d="M40 76c-9 0-16-7-16-14s7-13 14-13c2-11 11-18 22-18s20 8 20 19c9 0 15 5 15 12s-6 14-15 14z" />
        <g className="twinkle-slow">
          <path d="M150 34l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" />
          <path d="M196 56l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
          <path d="M172 14l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" />
        </g>
        <circle cx="196" cy="30" r="9" />
        <path d="M52 88l-3 8M72 88l-3 10M92 88l-3 8" />
        <path d="M118 104c8-16 22-24 38-24s28 8 36 24" />
      </g>
    </svg>
  );
}

/** Therapist hand-off confirmation: an envelope becoming a leaf. */
export function HandoffScene({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 130" className={className} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <path d="M28 44h96v54H28z" />
        <path d="M28 44l48 32 48-32" />
        <path d="M138 84c14-30 38-46 66-48-4 30-26 52-56 54" />
        <path d="M162 88c8-14 20-24 34-28" />
        <g className="twinkle-slow">
          <path d="M136 30l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" />
          <path d="M188 104l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
        </g>
      </g>
    </svg>
  );
}

/** Sleep card art: a bed under slow-twinkling stars. */
export function StarryBed({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 100" className={className} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
        <path d="M16 84V56h108a12 12 0 0112 12v16" />
        <path d="M16 72h120M16 84v8M136 84v8" />
        <path d="M40 56v-8h30v8" />
        <g className="twinkle-slow">
          <path d="M108 20l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" />
          <path d="M136 34l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" />
          <path d="M84 34l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6z" />
        </g>
      </g>
    </svg>
  );
}
