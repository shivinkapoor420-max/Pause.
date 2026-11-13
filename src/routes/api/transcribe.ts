import { createFileRoute } from "@tanstack/react-router";
import { transcriptionConfig } from "@/server/ai";
import { getAuth } from "@/server/auth";

const MAX_BYTES = 12 * 1024 * 1024;

/** Server-side transcription when a provider is configured. Without one, the
 *  browser's built-in speech recognition is used instead (see companion page). */
export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await getAuth(request);
        if (!auth) return new Response("Please sign in.", { status: 401 });
        const cfg = transcriptionConfig();
        if (!cfg)
          return new Response(
            "Voice transcription isn't configured — type instead, or use your browser's dictation.",
            { status: 503 },
          );
        const form = await request.formData();
        const audio = form.get("audio");
        if (!(audio instanceof File) || audio.size < 2048)
          return new Response("That recording was empty — please try again.", { status: 400 });
        if (audio.size > MAX_BYTES)
          return new Response("That recording is too long.", { status: 413 });
        const upstream = new FormData();
        upstream.append("model", cfg.model);
        upstream.append("file", audio, "recording.wav");
        const response = await fetch(cfg.url, {
          method: "POST",
          headers: { Authorization: `Bearer ${cfg.key}` },
          body: upstream,
        });
        if (!response.ok) {
          console.error(`transcription failed [${response.status}]`);
          return new Response("Transcription failed", { status: 502 });
        }
        const data = (await response.json()) as { text?: string };
        return Response.json({ text: data.text ?? "" });
      },
    },
  },
});
