/** Shared between client and server. */
export type AgeGroup = "early" | "kids" | "teen" | "adult";

export type GameDef = {
  id: string;
  title: string;
  blurb: string;
  how: string;
  emoji: string;
  hue: number;
  ages: AgeGroup[];
  premium: boolean;
  /** Only skill games can appear on leaderboards — never feelings or breathing. */
  ranked: boolean;
  difficulties: ("easy" | "medium" | "hard")[];
};

export const games: GameDef[] = [
  {
    id: "memory",
    title: "Memory Garden",
    blurb: "Flip cards, find the matching pairs.",
    how: "Tap two cards to turn them over. If they match, they stay open. Find every pair — there's no timer pressure unless you want it.",
    emoji: "🌼",
    hue: 140,
    ages: ["early", "kids", "teen", "adult"],
    premium: false,
    ranked: true,
    difficulties: ["easy", "medium", "hard"],
  },
  {
    id: "bubbles",
    title: "Breathing Bubbles",
    blurb: "Breathe with a bubble as it grows and shrinks.",
    how: "Breathe in while the bubble grows, out while it shrinks. Pop the little bubbles that float by on each out-breath.",
    emoji: "🫧",
    hue: 200,
    ages: ["early", "kids", "teen", "adult"],
    premium: false,
    ranked: false,
    difficulties: ["easy", "medium", "hard"],
  },
  {
    id: "colouring",
    title: "Colour Calm",
    blurb: "Fill a peaceful picture with your colours.",
    how: "Pick a colour, then tap a shape to fill it. There's no wrong way to colour. Save it to your journal when you're done.",
    emoji: "🎨",
    hue: 30,
    ages: ["early", "kids", "teen", "adult"],
    premium: false,
    ranked: false,
    difficulties: ["easy", "medium", "hard"],
  },
  {
    id: "emotions",
    title: "Feeling Faces",
    blurb: "Spot how someone might be feeling.",
    how: "Read the little story, then choose the feeling that fits. Lots of feelings can be right — we'll explain each one.",
    emoji: "😊",
    hue: 340,
    ages: ["early", "kids", "teen"],
    premium: false,
    ranked: false,
    difficulties: ["easy", "medium"],
  },
  {
    id: "puzzle",
    title: "Slide Puzzle",
    blurb: "Slide tiles back into order.",
    how: "Tap a tile next to the empty space to slide it. Put the numbers back in order from 1.",
    emoji: "🧩",
    hue: 260,
    ages: ["early", "kids", "teen", "adult"],
    premium: false,
    ranked: true,
    difficulties: ["easy", "medium", "hard"],
  },
  {
    id: "focus",
    title: "Firefly Focus",
    blurb: "Follow the glowing firefly — calm attention practice.",
    how: "Tap the firefly whenever it glows. Ignore the other lights. Short rounds, gentle pace.",
    emoji: "✨",
    hue: 55,
    ages: ["kids", "teen", "adult"],
    premium: false,
    ranked: true,
    difficulties: ["easy", "medium", "hard"],
  },
  {
    id: "reaction",
    title: "Leaf Catch",
    blurb: "Wait for the leaf to turn green, then tap.",
    how: "Watch the leaf. When it turns green, tap as quickly as you can. Tap too early and that round resets — it's practice in patience as much as speed.",
    emoji: "🍃",
    hue: 120,
    ages: ["kids", "teen", "adult"],
    premium: false,
    ranked: true,
    difficulties: ["easy", "medium", "hard"],
  },
  {
    id: "rhythm",
    title: "Rhythm Breeze",
    blurb: "Tap along with a slow, steady beat.",
    how: "A soft beat plays and a ring pulses. Tap in time with it. The beat slows gently as you go, to help your body settle.",
    emoji: "🎵",
    hue: 290,
    ages: ["kids", "teen", "adult"],
    premium: true,
    ranked: true,
    difficulties: ["easy", "medium", "hard"],
  },
  {
    id: "words",
    title: "Kind Words",
    blurb: "Unscramble calm and kind words, then reflect.",
    how: "Tap the letters in the right order to spell the word. Each word comes with a tiny reflection prompt.",
    emoji: "🔤",
    hue: 180,
    ages: ["kids", "teen", "adult"],
    premium: true,
    ranked: true,
    difficulties: ["easy", "medium", "hard"],
  },
  {
    id: "adventure",
    title: "Calm Quest",
    blurb: "A choose-your-path journey through a quiet forest.",
    how: "Read each scene and choose what to do. Every path has a calming exercise hidden in it. There's no way to lose.",
    emoji: "🌲",
    hue: 160,
    ages: ["early", "kids", "teen", "adult"],
    premium: true,
    ranked: false,
    difficulties: ["easy"],
  },
];

export const gameById = Object.fromEntries(games.map((g) => [g.id, g])) as Record<string, GameDef>;
