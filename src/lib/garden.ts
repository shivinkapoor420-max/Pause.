import type { AppState } from "@/lib/app-state";

/**
 * The Growth Garden.
 *
 * Where the inner weather shows the last few days, the garden shows everything.
 * It only ever grows: there is no wilting state, no "missed a week" visual and
 * nothing is ever taken away for a gap. A keepsake, not a chart.
 */

export type GardenItem = {
  kind: "leaf" | "flower" | "bird" | "stone" | "fern";
  /** Stable index used to place and shape the item. */
  n: number;
  /** Plain-language reason it appeared. */
  because: string;
};

export type Garden = {
  items: GardenItem[];
  headline: string;
  note: string;
};

export function buildGarden(state: AppState): Garden {
  const checkins = state.moods.length;
  const journal = state.journal.length;
  const tools = Object.values(state.toolUse).reduce((a, b) => a + b, 0);
  const grounding = state.groundingSessions.length;
  const talks = state.companion.filter((s) => s.turns.length > 0).length;

  const items: GardenItem[] = [];
  const push = (kind: GardenItem["kind"], count: number, because: string) => {
    for (let i = 0; i < count; i++) items.push({ kind, n: items.length, because });
  };

  push("leaf", Math.min(24, checkins), "a day you checked in");
  push("flower", Math.min(14, Math.floor(journal / 2)), "words you wrote down");
  push("fern", Math.min(10, Math.floor(tools / 2)), "time spent with a coping tool");
  push("stone", Math.min(8, grounding), "a minute in the Grounding Room");
  push("bird", Math.min(6, Math.floor(talks / 2)), "a conversation with Pip");

  const total = items.length;
  const headline =
    total === 0
      ? "Bare soil, and that's exactly right for day one."
      : total < 6
        ? "Something's started here."
        : total < 16
          ? "It's filling in."
          : total < 32
            ? "This has been growing a while."
            : "A whole season of showing up lives here.";

  const note =
    total === 0
      ? "Every check-in, journal entry and quiet minute adds something. Nothing is ever removed."
      : "Nothing here ever wilts and nothing is lost for a gap — it only grows, at whatever pace you do.";

  return { items, headline, note };
}
