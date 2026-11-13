import { useMemo } from "react";
import type { InnerWeather } from "@/lib/weather";
import { useApp } from "@/lib/app-state";
import { cn } from "@/lib/utils";

/** Tiny deterministic PRNG so a visit is self-consistent but never repeated. */
function rng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * A slowly generative illustrated sky in the app's linework style.
 * Not a chart: no axes, no numbers, nothing that could be read as a score.
 */
export function InnerSky({ weather, className }: { weather: InnerWeather; className?: string }) {
  const { state } = useApp();
  const motion = state.settings.calmMode ? "none" : state.settings.motion;
  const still = motion === "none";

  const scene = useMemo(() => {
    const rand = rng(Math.floor(weather.seed / 60000) + 7);
    const cloudCount = 2 + Math.round(weather.weight * 5);
    const clouds = Array.from({ length: cloudCount }, (_, i) => ({
      id: i,
      x: 8 + rand() * 84,
      y: 14 + rand() * 34,
      scale: 0.55 + rand() * 0.85,
      speed: 34 + rand() * 40,
      delay: -rand() * 40,
      soft: rand() > 0.5,
    }));
    const rainCount = weather.weight > 0.58 ? Math.round((weather.weight - 0.5) * 60) : 0;
    const rain = Array.from({ length: rainCount }, (_, i) => ({
      id: i,
      x: 6 + rand() * 88,
      y: 46 + rand() * 34,
      len: 3 + rand() * 5,
    }));
    const birds = weather.weight < 0.45 ? 1 + Math.round(rand() * 2) : 0;
    return { clouds, rain, birds, sunX: 24 + rand() * 52 };
  }, [weather.seed, weather.weight]);

  const warmStop = `color-mix(in oklch, var(--color-mustard) ${Math.round(
    30 + weather.warmth * 55,
  )}%, var(--color-background))`;
  const coolStop = `color-mix(in oklch, var(--color-lavender) ${Math.round(
    30 + (1 - weather.warmth) * 55,
  )}%, var(--color-background))`;

  if (still) {
    return (
      <div
        className={cn("w-full overflow-hidden rounded-3xl border-2 border-ink", className)}
        role="img"
        aria-label={weather.line}
        style={{
          aspectRatio: "16 / 11",
          background: `linear-gradient(170deg, ${coolStop} 0%, ${warmStop} 100%)`,
        }}
      />
    );
  }

  return (
    <div
      className={cn("relative w-full overflow-hidden rounded-3xl border-2 border-ink", className)}
      role="img"
      aria-label={weather.line}
      style={{
        aspectRatio: "16 / 11",
        background: `linear-gradient(170deg, ${coolStop} 0%, ${warmStop} 100%)`,
      }}
    >
      <svg viewBox="0 0 100 68" className="absolute inset-0 size-full" aria-hidden="true">
        {/* sun or veiled sun */}
        <g className={motion === "full" ? "bloom-pulse" : undefined}>
          <circle
            cx={scene.sunX}
            cy={16}
            r={9 - weather.weight * 3}
            fill="color-mix(in oklch, var(--color-mustard) 70%, transparent)"
          />
          <circle
            cx={scene.sunX}
            cy={16}
            r={9 - weather.weight * 3}
            fill="none"
            stroke="var(--color-ink)"
            strokeWidth={0.5}
            opacity={0.5}
          />
        </g>

        {/* drifting clouds */}
        {scene.clouds.map((c) => (
          <g
            key={c.id}
            transform={`translate(${c.x} ${c.y}) scale(${c.scale})`}
            className={motion === "full" ? "sky-drift-slow" : undefined}
            style={
              motion === "full"
                ? {
                    animationDuration: `${c.speed * (0.6 + weather.wind)}s`,
                    animationDelay: `${c.delay}s`,
                  }
                : undefined
            }
          >
            <path
              d="M0 6 C0 2.5 3 0.5 6 1.5 C7.5 -1 12 -1 13.5 1.8 C17 1 19.5 3 19 6 Z"
              fill={
                c.soft
                  ? "color-mix(in oklch, var(--color-card) 82%, transparent)"
                  : "color-mix(in oklch, var(--color-lavender) 70%, transparent)"
              }
              stroke="var(--color-ink)"
              strokeWidth={0.45}
              strokeLinejoin="round"
              opacity={0.9}
            />
          </g>
        ))}

        {/* rain, only when the stretch has been heavy */}
        {scene.rain.map((r) => (
          <line
            key={r.id}
            x1={r.x}
            y1={r.y}
            x2={r.x - 1.2}
            y2={r.y + r.len}
            stroke="var(--color-forest)"
            strokeWidth={0.4}
            opacity={0.45}
            strokeLinecap="round"
          />
        ))}

        {/* far birds on the brighter stretches */}
        {Array.from({ length: scene.birds }, (_, i) => (
          <path
            key={i}
            d={`M${62 + i * 7} ${20 + i * 4} q2 -2 4 0 q2 -2 4 0`}
            fill="none"
            stroke="var(--color-ink)"
            strokeWidth={0.5}
            opacity={0.55}
            strokeLinecap="round"
          />
        ))}

        {/* horizon linework */}
        <path
          d="M0 58 q14 -4 26 0 t26 -1 t26 2 t22 -1"
          fill="none"
          stroke="var(--color-forest)"
          strokeWidth={0.7}
          opacity={0.7}
        />
        <path
          d="M0 62 q18 -3 34 1 t32 -2 t34 2 V68 H0 Z"
          fill="color-mix(in oklch, var(--color-forest) 22%, transparent)"
        />
      </svg>
    </div>
  );
}
