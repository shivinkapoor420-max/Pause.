import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { env } from "./db";

/**
 * Configurable AI provider. Any OpenAI-compatible API works (OpenAI, Groq,
 * Together, OpenRouter, a local Ollama/LM Studio server…), plus the Lovable
 * gateway for projects that still have LOVABLE_API_KEY. With nothing set, the
 * app uses the built-in offline companion below — no key required.
 */
export function aiModel() {
  const base = env("AI_BASE_URL");
  const key = env("AI_API_KEY");
  if (base) {
    const provider = createOpenAICompatible({
      name: "pause-ai",
      baseURL: base,
      ...(key ? { apiKey: key } : {}),
    });
    return provider(env("AI_MODEL", "gpt-4o-mini"));
  }
  const lovable = env("LOVABLE_API_KEY");
  if (lovable) {
    const provider = createOpenAICompatible({
      name: "lovable",
      baseURL: "https://ai.gateway.lovable.dev/v1",
      headers: { "Lovable-API-Key": lovable, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });
    return provider(env("AI_MODEL", "google/gemini-3.6-flash"));
  }
  return null;
}

export function transcriptionConfig() {
  const base = env("AI_BASE_URL");
  if (base && env("AI_TRANSCRIBE_MODEL")) {
    return {
      url: `${base.replace(/\/$/, "")}/audio/transcriptions`,
      key: env("AI_API_KEY"),
      model: env("AI_TRANSCRIBE_MODEL"),
      header: "Authorization",
    };
  }
  const lovable = env("LOVABLE_API_KEY");
  if (lovable)
    return {
      url: "https://ai.gateway.lovable.dev/v1/audio/transcriptions",
      key: lovable,
      model: "openai/gpt-4o-mini-transcribe",
      header: "Authorization",
    };
  return null;
}

// ---------------------------------------------------------------- offline companion
// A careful, rule-based reflective listener. It never diagnoses or advises; it
// names feelings it hears, reflects specifics back and asks at most one question.

const feelingLexicon: [RegExp, string, string][] = [
  [
    /\b(anxious|anxiety|nervous|worried|worry|worrying|panic|panicky|on edge|uneasy)\b/i,
    "worried",
    "nervous",
  ],
  [
    /\b(stress|stressed|pressure|overwhelm|overwhelmed|too much|swamped|drowning)\b/i,
    "overwhelmed",
    "like everything's piling up",
  ],
  [/\b(sad|down|low|blue|cry|crying|cried|heartbroken|miss|missing|lonely|alone)\b/i, "sad", "sad"],
  [/\b(angry|mad|furious|annoyed|irritated|frustrated|unfair|hate)\b/i, "frustrated", "cross"],
  [/\b(tired|exhausted|drained|burnt out|burned out|no energy|sleepy)\b/i, "worn out", "tired"],
  [/\b(scared|afraid|frightened|terrified|fear)\b/i, "scared", "scared"],
  [/\b(happy|glad|excited|good|great|proud|relieved|calm|better)\b/i, "lighter", "happy"],
  [/\b(confused|lost|stuck|don'?t know|unsure|numb)\b/i, "unsure", "mixed up"],
  [/\b(embarrassed|ashamed|guilty|stupid|awkward)\b/i, "exposed", "embarrassed"],
];

const subjectRe =
  /\b(my (?:mum|mom|dad|mother|father|sister|brother|friend|friends|boss|teacher|partner|boyfriend|girlfriend|wife|husband|family|class|exam|exams|job|work|dog|cat|grandma|grandpa|teacher)|the (?:deadline|exam|test|meeting|interview|presentation|project|party|game|news)|school|work|college|uni|university|homework|exams?)\b/i;

const adultReflections = [
  "It sounds like you're feeling {feeling}{about}.",
  "There's a lot of {feeling} in what you just wrote{about}.",
  "I'm hearing something {feeling}{about} — that's a real thing to be carrying.",
  "That sounds {feelingAdj}{about}. I'm here with it.",
  "{About}, it makes sense that you'd feel {feeling}.",
];
const adultQuestions = [
  "What part of it is sitting heaviest right now?",
  "When did you first notice it today?",
  "What would you want someone to understand about it?",
  "How is your body holding it — tight, heavy, restless?",
  "Is there anything about it you haven't said out loud yet?",
];
const adultNeutral = [
  "I'm listening. Take whatever time you need.",
  "Thank you for telling me that. Say more, if you'd like.",
  "I'm here. What's been on your mind the most?",
  "That matters. What else is around it?",
  "Go on — I'm following.",
];
const childReflections = [
  "Thank you for telling me. It sounds like you feel {kid}{about}.",
  "Feeling {kid} is okay{about}. Lots of people feel that way sometimes.",
  "Oh, that sounds like a {weather} kind of feeling{about}.",
  "I'm so glad you told me you feel {kid}.",
];
const childQuestions = [
  "Where do you feel it in your body?",
  "What colour would that feeling be?",
  "Would you like to take a big slow breath with me?",
  "Who could give you a hug today?",
];
const childNeutral = [
  "I'm listening. Tell me more!",
  "That's interesting. What happened next?",
  "I'm right here with you.",
];

const weatherFor: Record<string, string> = {
  nervous: "windy",
  "like everything's piling up": "stormy",
  sad: "rainy",
  cross: "thundery",
  tired: "cloudy",
  scared: "stormy",
  happy: "sunny",
  "mixed up": "foggy",
  embarrassed: "cloudy",
};

const crisisRe =
  /\b(kill(ing)? (myself|me)|end (it|my life)|suicid|hurt(ing)? (myself|me)|cut(ting)? myself|don'?t want to (be here|live|wake up)|better off (dead|gone)|want to die|not safe (at home|here)|(hits|hit|hurts|touched) me)\b/i;

function pick<T>(list: T[], used: Set<string>, seed: number): T {
  const fresh = list.filter((x) => !used.has(String(x)));
  const pool = fresh.length ? fresh : list;
  return pool[seed % pool.length]!;
}

export function offlineReply(userText: string, previous: string[], child: boolean): string {
  const used = new Set(previous);
  const seed = userText.length + previous.length * 7;
  if (crisisRe.test(userText)) {
    return child
      ? "Thank you for being brave and telling me. This is really important — please tell a grown-up you trust right now. The help button on the screen can help too."
      : "I'm really glad you told me. You don't have to hold this alone — the crisis support on your screen can connect you with a real person right now, any time of day.";
  }
  const hit = feelingLexicon.find(([re]) => re.test(userText));
  const subject = userText
    .match(subjectRe)?.[0]
    ?.toLowerCase()
    .replace(/\bmy\b/, "your");
  const about = subject ? ` about ${subject}` : "";
  const About = subject ? `With ${subject} in the middle of it` : "With all of that going on";
  const fill = (t: string) =>
    t
      .replace("{feeling}", hit?.[1] ?? "a lot")
      .replace("{feelingAdj}", hit?.[1] ?? "heavy")
      .replace("{kid}", hit?.[2] ?? "a big feeling")
      .replace("{weather}", weatherFor[hit?.[2] ?? ""] ?? "cloudy")
      .replace("{about}", about)
      .replace("{About}", About);
  if (child) {
    const first = hit ? fill(pick(childReflections, used, seed)) : pick(childNeutral, used, seed);
    const ask = seed % 2 === 0 ? ` ${pick(childQuestions, used, seed + 1)}` : "";
    return `${first}${ask}`;
  }
  const first =
    hit || subject ? fill(pick(adultReflections, used, seed)) : pick(adultNeutral, used, seed);
  const ask =
    userText.length > 25 && seed % 3 !== 0 ? ` ${pick(adultQuestions, used, seed + 3)}` : "";
  return `${first}${ask}`;
}

export function offlineObservation(text: string) {
  const map: Record<string, string> = {
    worried: "nervous",
    overwhelmed: "overwhelmed",
    sad: "sad",
    frustrated: "frustrated",
    "worn out": "withdrawn",
    scared: "fearful",
    lighter: "happy",
    unsure: "confused",
    exposed: "nervous",
  };
  const hit = feelingLexicon.find(([re]) => re.test(text));
  return {
    state: hit ? (map[hit[1]] ?? "calm") : "calm",
    confidence: hit ? 0.35 : 0.15,
    energy: text.length > 160 ? "high" : text.length < 30 ? "low" : "steady",
    engagement: text.length > 60 ? "high" : "steady",
    note: hit
      ? `Words like these can carry a ${hit[1]} feeling.`
      : "Not much to go on — that's okay.",
  };
}
