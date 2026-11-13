import type { AppState, Sky } from "@/lib/app-state";

/**
 * The Inner Weather System.
 *
 * Texture and feeling only. This never touches "Patterns Worth Exploring":
 * no scores, no confidence bands, no condition names, nothing to read as a
 * number. It describes the emotional climate of the last few days as weather.
 */

const heaviness: Record<Sky, number> = { sunny: 0, partly: 1, cloudy: 2, rainy: 3, stormy: 4 };

export type InnerWeather = {
  /** 0 (bright and open) → 1 (heavy and close). */
  weight: number;
  /** 0 (cool) → 1 (warm) colour temperature. */
  warmth: number;
  /** How changeable the last few days have been, 0–1. */
  variability: number;
  /** Ambient movement, 0–1. Rendering still respects the motion setting. */
  wind: number;
  /** A single plain-language line. Never a label, never a number. */
  line: string;
  /** A stable-ish seed so no two visits look quite the same. */
  seed: number;
};

const heavyStates = new Set(["sad", "overwhelmed", "fearful", "angry", "frustrated", "withdrawn"]);
const warmStates = new Set(["happy", "excited", "calm", "curious"]);

export function readInnerWeather(state: AppState, seed = Date.now()): InnerWeather {
  const cutoff = Date.now() - 6 * 86400000;

  const moods = state.moods.filter((m) => new Date(m.date).getTime() >= cutoff);
  const journal = state.journal.filter((j) => new Date(j.date).getTime() >= cutoff);
  const observations = state.companion
    .flatMap((s) => s.observations)
    .filter((o) => new Date(o.at).getTime() >= cutoff);

  const skyValues = [
    ...moods.map((m) => heaviness[m.sky] / 4),
    ...journal.filter((j) => j.sky).map((j) => heaviness[j.sky as Sky] / 4),
  ];

  const obsWeight = observations.length
    ? observations.filter((o) => heavyStates.has(o.state)).length / observations.length
    : null;

  const parts = [...skyValues, ...(obsWeight === null ? [] : [obsWeight, obsWeight])];
  const weight = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 0.35;

  const spread =
    skyValues.length > 1
      ? Math.min(1, (Math.max(...skyValues) - Math.min(...skyValues)) * 1.15)
      : 0.25;

  const brightObs = observations.filter((o) => warmStates.has(o.state)).length;
  const warmth = Math.min(
    1,
    Math.max(
      0,
      0.62 - weight * 0.5 + (observations.length ? (brightObs / observations.length) * 0.3 : 0.1),
    ),
  );

  const energetic = observations.filter((o) => o.energy === "high").length;
  const wind = Math.min(
    1,
    0.25 + spread * 0.45 + (observations.length ? (energetic / observations.length) * 0.3 : 0),
  );

  return {
    weight,
    warmth,
    variability: spread,
    wind,
    line: describe(weight, spread, moods.length + journal.length + observations.length),
    seed,
  };
}

function describe(weight: number, spread: number, samples: number): string {
  if (samples === 0) return "The sky hasn't been read yet — check in and it starts filling itself in.";

  const base =
    weight < 0.25
      ? "a bright, open stretch"
      : weight < 0.45
        ? "a calm week"
        : weight < 0.62
          ? "a mostly overcast few days"
          : weight < 0.8
            ? "a heavy, rainy stretch"
            : "a stormy few days";

  const texture =
    spread < 0.2
      ? "holding fairly steady"
      : spread < 0.45
        ? "with a little morning fog"
        : spread < 0.7
          ? "clearing and closing in again"
          : "changing hour to hour";

  return `${cap(base)}, ${texture}.`;
}

/** Pip's spoken version for the 4–10 track — simpler words, said out loud. */
export function narrateForChild(w: InnerWeather): string {
  if (w.weight < 0.3) return "Today feels like a sunny day, with just a few little clouds.";
  if (w.weight < 0.5) return "Today feels like sunshine and clouds taking turns.";
  if (w.weight < 0.7) return "Today feels cloudy and soft, like the sky is resting.";
  return "Today feels rainy. Rainy days are okay too, and they always pass.";
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
