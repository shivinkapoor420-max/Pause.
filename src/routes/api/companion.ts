import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, streamText, type UIMessage } from "ai";
import { aiModel, offlineReply } from "@/server/ai";
import { getAuth } from "@/server/auth";
import { db } from "@/server/db";
import { FREE_AI_DAILY, KIDS_AI_DAILY, PREMIUM_AI_DAILY, isPremium } from "@/server/services";
import { prompts } from "@/server/prompts";

function textOf(m: UIMessage | undefined) {
  return (m?.parts ?? []).map((p) => (p.type === "text" ? p.text : "")).join(" ").trim();
}

export const Route = createFileRoute("/api/companion")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await getAuth(request);
        if (!auth) return new Response("Please sign in.", { status: 401 });
        const group = auth.user.age_group;
        const controls = (auth.user.prefs["controls"] as { aiCompanion?: boolean } | undefined) ?? {};
        // Ages 4–7 never get open-ended AI chat; guardians can switch it off for 8–17.
        if (group === "early" || auth.childMode) return new Response("Pip chat isn't available for this profile.", { status: 403 });
        if (auth.user.guardian_id && controls.aiCompanion === false) {
          return new Response("Your grown-up has paused chatting with Pip for now.", { status: 403 });
        }
        const body = (await request.json()) as { messages?: unknown; recap?: string; primer?: string };
        if (!Array.isArray(body.messages)) return new Response("Messages are required", { status: 400 });
        const messages = (body.messages as UIMessage[]).slice(-40);

        // Daily usage limits (free vs premium; stricter for children).
        const premium = await isPremium(auth.user);
        const limit = group === "adult" ? (premium ? PREMIUM_AI_DAILY : FREE_AI_DAILY) : KIDS_AI_DAILY;
        const sql = await db();
        const [usage] = await sql`insert into ai_usage (user_id, day, count) values (${auth.user.id}, current_date, 1)
          on conflict (user_id, day) do update set count = ai_usage.count + 1 returning count`;
        if ((usage?.["count"] as number) > limit) {
          const msg =
            group === "adult" && !premium
              ? `You've reached today's ${FREE_AI_DAILY} free messages with Pip. Premium raises the limit, and the breathing and grounding tools are always free.`
              : "That's plenty of chatting for today. Pip will be here tomorrow — maybe try a breathing game?";
          return new Response(msg, { status: 429 });
        }

        const model = aiModel();
        const young = group === "kids";
        if (!model) {
          // Offline companion: no API key needed.
          const previous = messages.filter((m) => m.role === "assistant").map(textOf);
          const reply = offlineReply(textOf([...messages].reverse().find((m) => m.role === "user")), previous, young);
          const stream = createUIMessageStream({
            originalMessages: messages,
            execute: async ({ writer }) => {
              const id = crypto.randomUUID();
              writer.write({ type: "text-start", id });
              for (const word of reply.split(/(?<= )/)) {
                writer.write({ type: "text-delta", id, delta: word });
                await new Promise((r) => setTimeout(r, 28));
              }
              writer.write({ type: "text-end", id });
            },
          });
          return createUIMessageStreamResponse({ stream });
        }

        const base = prompts[group];
        const recap = auth.user.memory_consent ? (body.recap ?? "").trim().slice(0, 1500) : "";
        const primer = auth.user.memory_consent ? (body.primer ?? "").trim().slice(0, 500) : "";
        const context = [
          recap && `From earlier conversations with this person (context only — do not recite it back):\n${recap}`,
          primer && `Quiet background from recent check-ins (NEVER quote or mention it; let it shape tone only):\n${primer}`,
        ]
          .filter(Boolean)
          .join("\n\n");
        const result = streamText({
          model,
          temperature: young ? 0.7 : 0.9,
          maxOutputTokens: young ? 120 : 300,
          system: context ? `${base}\n\n${context}` : base,
          messages: await convertToModelMessages(messages),
        });
        return result.toUIMessageStreamResponse({ originalMessages: messages });
      },
    },
  },
});
