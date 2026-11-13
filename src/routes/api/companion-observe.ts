import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
import { COMPANION_MODEL, createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

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
        const body = (await request.json()) as {
          transcript?: string;
          acoustics?: { seconds?: number; wordsPerMinute?: number };
        };
        const transcript = (body.transcript ?? "").trim();
        if (!transcript) return new Response("Transcript required", { status: 400 });

        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const gateway = createLovableAiGatewayProvider(key);
        const acoustics = body.acoustics
          ? `Basic audio signals (context only, not evidence): about ${body.acoustics.seconds ?? 0}s of speech at roughly ${body.acoustics.wordsPerMinute ?? 0} words per minute.`
          : "";

        try {
          const { text } = await generateText({
            model: gateway(COMPANION_MODEL),
            system,
            prompt: `${acoustics}\n\nWhat they said:\n"""${transcript.slice(0, 4000)}"""`,
          });

          const match = text.match(/\{[\s\S]*\}/);
          const parsed = match ? (JSON.parse(match[0]) as Record<string, unknown>) : null;
          if (!parsed) return Response.json({ observation: null });

          const state = STATES.includes(parsed["state"] as (typeof STATES)[number])
            ? (parsed["state"] as string)
            : "calm";
          const confidence = Math.max(0, Math.min(1, Number(parsed["confidence"] ?? 0.3)));

          return Response.json({
            observation: {
              state,
              confidence,
              energy: ["low", "steady", "high"].includes(String(parsed["energy"]))
                ? parsed["energy"]
                : "steady",
              engagement: ["low", "steady", "high"].includes(String(parsed["engagement"]))
                ? parsed["engagement"]
                : "steady",
              note: String(parsed["note"] ?? "").slice(0, 240),
            },
          });
        } catch (error) {
          console.error("companion-observe failed", error);
          return new Response("Tone reading unavailable", { status: 502 });
        }
      },
    },
  },
});
