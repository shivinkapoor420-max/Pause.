import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
import { aiModel, offlineObservation } from "@/server/ai";
import { getAuth } from "@/server/auth";

const STATES = [
  "happy",
  "excited",
  "calm",
  "curious",
  "nervous",
  "sad",
  "frustrated",
  "angry",
  "fearful",
  "overwhelmed",
  "withdrawn",
  "confused",
] as const;

const system = `You read the emotional tone of a short piece of conversation from a support app and return JSON only.
You are NOT a diagnostician. You never name a condition. You describe tone and engagement as an observation with a confidence level.
Be conservative: an unusual pace, long pauses, flat delivery or few words can simply be someone's natural communication style — including many autistic and neurodivergent people — so keep confidence low unless the words themselves clearly carry the feeling.
Return exactly this JSON shape and nothing else:
{"state":"<one of ${STATES.join("|")}>","confidence":<0-1 number>,"energy":"low|steady|high","engagement":"low|steady|high","note":"<one short, gentle, non-clinical sentence describing what you noticed>"}`;

export const Route = createFileRoute("/api/companion-observe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await getAuth(request);
        if (!auth) return new Response("Please sign in.", { status: 401 });
        const body = (await request.json()) as {
          transcript?: string;
          acoustics?: { seconds?: number; wordsPerMinute?: number };
        };
        const transcript = (body.transcript ?? "").trim().slice(0, 4000);
        if (!transcript) return new Response("Transcript required", { status: 400 });
        const model = aiModel();
        if (!model) return Response.json({ observation: offlineObservation(transcript) });
        try {
          const { text } = await generateText({
            model,
            system,
            prompt: `What they said:\n"""${transcript}"""`,
          });
          const match = text.match(/\{[\s\S]*\}/);
          const parsed = match ? (JSON.parse(match[0]) as Record<string, unknown>) : null;
          if (!parsed) return Response.json({ observation: null });
          const pickOf = (v: unknown) =>
            ["low", "steady", "high"].includes(String(v)) ? v : "steady";
          return Response.json({
            observation: {
              state: STATES.includes(parsed["state"] as (typeof STATES)[number])
                ? parsed["state"]
                : "calm",
              confidence: Math.max(0, Math.min(1, Number(parsed["confidence"] ?? 0.3))),
              energy: pickOf(parsed["energy"]),
              engagement: pickOf(parsed["engagement"]),
              note: String(parsed["note"] ?? "").slice(0, 240),
            },
          });
        } catch (error) {
          console.error("companion-observe failed", error);
          return Response.json({ observation: offlineObservation(transcript) });
        }
      },
    },
  },
});
