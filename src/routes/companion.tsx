import { useChat } from "@ai-sdk/react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Mic, Square, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { AppShell, CrisisBanner, PillButton, ScreeningNote } from "@/components/app-shell";
import { Companion } from "@/components/companion-character";
import { detectCrisis } from "@/lib/crisis";
import { pipPrimer } from "@/lib/insights";
import { basicAcoustics, startRecording, type Recording } from "@/lib/recorder";
import { speak, useApp, type CompanionObservation } from "@/lib/app-state";

export const Route = createFileRoute("/companion")({
  head: () => ({
    meta: [
      { title: "Talk to Pip — Pause." },
      {
        name: "description",
        content:
          "Pip is an AI companion that listens. Kids can talk out loud; teens and adults can type. No advice, no diagnosis — just company.",
      },
      { property: "og:title", content: "Talk to Pip — Pause." },
      {
        property: "og:description",
        content: "A warm AI companion whose only job is to listen, with crisis resources one tap away.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Talk to Pip — Pause." },
      {
        name: "twitter:description",
        content: "A warm AI companion whose only job is to listen, with crisis resources one tap away.",
      },
    ],
  }),
  component: CompanionPage,
});

function textOf(message: UIMessage) {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
}

function CompanionPage() {
  const { state, ready } = useApp();
  const band = state.band ?? "adult";
  const child = band === "child";

  if (!ready) return <AppShell title="Companion">{null}</AppShell>;

  if (child && !state.voiceConsent) return <VoiceConsentGate />;

  return <Chat key={band} mode={child ? "voice" : "text"} />;
}

function VoiceConsentGate() {
  const { state, update } = useApp();
  return (
    <AppShell title="Caregiver consent">
      <div className="card-soft mt-4 p-6">
        <Companion className="size-24 text-forest" />
        <h2 className="mt-3 font-display text-3xl font-black">
          Meet Pip — with your permission first
        </h2>
        <p className="mt-2 text-muted-foreground">
          Pip is an AI friend {state.name || "your child"} can talk out loud to. Underneath the
          conversation, Pause. gently notes emotional tone so you can spot trends that are easy to
          miss day to day. Before anything is recorded, we need you — the caregiver — to agree:
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          <li>· Recordings and transcripts stay on this device, and you can delete them any time.</li>
          <li>· Nothing here is a diagnosis. Tone is an observation, with a confidence level.</li>
          <li>
            · Your child is compared only to their own history — never to other children — and a
            different speech style is never treated as distress.
          </li>
          <li>· Voice data is never used for advertising or unrelated model training.</li>
          <li>· Your child always knows they're talking to an AI friend, and opts in each time.</li>
        </ul>
        <div className="mt-5 flex flex-wrap gap-3">
          <PillButton variant="primary" onClick={() => update({ voiceConsent: true })}>
            I'm the caregiver — I agree
          </PillButton>
          <Link to="/home">
            <PillButton variant="outline">Not now</PillButton>
          </Link>
        </div>
        <label className="mt-4 flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={state.snippetConsent}
            onChange={(e) => update({ snippetConsent: e.target.checked })}
            className="mt-1 size-5"
          />
          <span>
            Also keep short transcript snippets in the caregiver view (optional — tone notes work
            without them).
          </span>
        </label>
      </div>
      <div className="mt-5">
        <ScreeningNote />
      </div>
    </AppShell>
  );
}

function Chat({ mode }: { mode: "voice" | "text" }) {
  const {
    state,
    startCompanionSession,
    addCompanionTurn,
    addCompanionObservation,
    flagRisk,
    clearVoiceData,
  } = useApp();
  const band = state.band ?? "adult";
  const child = mode === "voice";
  const [sessionId] = useState(() => startCompanionSession(mode));
  const [crisis, setCrisis] = useState(false);
  const [latest, setLatest] = useState<CompanionObservation | null>(null);
  const [input, setInput] = useState("");
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<Awaited<ReturnType<typeof startRecording>> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const savedRef = useRef(0);

  // Carry a little context across sessions so Pip doesn't make anyone start over.
  const recap = useMemo(() => {
    const lines: string[] = [];
    for (const session of state.companion.slice(0, 4)) {
      if (session.id === sessionId) continue;
      const said = session.turns
        .filter((t) => t.role === "user")
        .slice(-4)
        .map((t) => t.text.slice(0, 180));
      if (said.length === 0) continue;
      lines.push(
        `${new Date(session.date).toLocaleDateString()}: ${said.map((s) => `"${s}"`).join(" ")}`,
      );
    }
    return lines.join("\n");
  }, [state.companion, sessionId]);

  // Two or three plain sentences from very recent check-ins and journal entries, so
  // Pip isn't starting from zero. Never shown, never recited — it only shapes tone.
  const primer = useMemo(() => pipPrimer(state), [state]);

  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/companion", body: { band, recap, primer } }),
    [band, recap, primer],
  );

  const { messages, sendMessage, status } = useChat({
    id: sessionId,
    transport,
    onError: (e) => setError(e.message),
  });

  const thinking = status === "submitted" || status === "streaming";

  // Persist finished turns on-device, and route anything urgent to the crisis pathway.
  useEffect(() => {
    if (thinking) return;
    for (let i = savedRef.current; i < messages.length; i++) {
      const message = messages[i]!;
      const text = textOf(message);
      if (!text) continue;
      addCompanionTurn(sessionId, {
        role: message.role === "user" ? "user" : "companion",
        text,
      });
      if (message.role === "user" && detectCrisis(text)) {
        setCrisis(true);
        flagRisk();
      }
      if (message.role === "assistant" && child) speak(text, true);
    }
    savedRef.current = messages.length;
  }, [messages, thinking, sessionId, addCompanionTurn, flagRisk, child]);

  useEffect(() => {
    if (!thinking) textareaRef.current?.focus();
  }, [thinking, messages.length]);

  const observe = useCallback(
    async (transcript: string, acoustics?: ReturnType<typeof basicAcoustics>) => {
      try {
        const response = await fetch("/api/companion-observe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript, acoustics }),
        });
        if (!response.ok) return;
        const data = (await response.json()) as { observation: CompanionObservation | null };
        if (!data.observation) return;
        const observation: CompanionObservation = {
          ...data.observation,
          at: new Date().toISOString(),
          ...(state.snippetConsent ? { snippet: transcript.slice(0, 160) } : {}),
        };
        setLatest(observation);
        addCompanionObservation(sessionId, observation);
      } catch {
        /* tone reading is optional context, never blocking */
      }
    },
    [addCompanionObservation, sessionId, state.snippetConsent],
  );

  const send = useCallback(
    async (text: string, acoustics?: ReturnType<typeof basicAcoustics>) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setError(null);
      if (detectCrisis(trimmed)) {
        setCrisis(true);
        flagRisk();
      }
      await sendMessage({ text: trimmed });
      void observe(trimmed, acoustics);
    },
    [sendMessage, observe, flagRisk],
  );

  const toggleRecording = useCallback(async () => {
    if (recording) {
      const handle = recorder.current;
      recorder.current = null;
      setRecording(false);
      if (!handle) return;
      setBusy("Listening to what you said…");
      try {
        const clip: Recording = await handle.stop();
        const form = new FormData();
        form.append("audio", clip.blob, "recording.wav");
        const response = await fetch("/api/transcribe", { method: "POST", body: form });
        if (!response.ok) throw new Error(await response.text());
        const { text } = (await response.json()) as { text: string };
        if (!text.trim()) throw new Error("I didn't quite catch that — want to try again?");
        await send(text, basicAcoustics(clip, text.trim().split(/\s+/).length));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        setBusy(null);
      }
      return;
    }
    try {
      recorder.current = await startRecording();
      setRecording(true);
    } catch {
      setError("Pause. needs microphone access to hear you.");
    }
  }, [recording, send]);

  const lateNight = new Date().getHours() >= 23 || new Date().getHours() < 5;
  const longSession = messages.filter((m) => m.role === "user").length >= 8;
  const nudge = band === "teen" && (lateNight || longSession);

  return (
    <AppShell title={child ? "Talk to Pip" : "Listening companion"}>
      <div className="flex items-start gap-4">
        <Companion
          className="size-20 shrink-0 text-forest"
          state={recording ? "listening" : thinking ? "thinking" : "idle"}
        />
        <div>
          <h2 className="font-display text-3xl font-black tracking-tight">
            {child ? "Pip is listening" : "I'm here with you"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {child
              ? "Pip is an AI friend, not a person. Tap the big button and talk out loud."
              : "Pip is an AI companion whose only job is to listen — no advice, no fixing, no diagnosis."}
          </p>
        </div>
      </div>

      {(crisis || state.riskFlagged) && (
        <div className="mt-4">
          <CrisisBanner />
        </div>
      )}

      <div className="card-soft mt-5 flex h-[52vh] flex-col overflow-hidden">
        <Conversation className="flex-1">
          <ConversationContent className="gap-3">
            {messages.length === 0 && (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                {child
                  ? "Say hello whenever you're ready. There's no wrong thing to say."
                  : "Start anywhere. Take your time — there's no rush."}
              </p>
            )}
            {messages.map((message) => {
              const text = textOf(message);
              if (!text) return null;
              return (
                <Message from={message.role} key={message.id}>
                  {message.role === "assistant" ? (
                    <MessageResponse>{text}</MessageResponse>
                  ) : (
                    <MessageContent className="bg-primary text-primary-foreground">
                      {text}
                    </MessageContent>
                  )}
                </Message>
              );
            })}
            {thinking && (
              <Shimmer className="px-2 text-sm">
                {child ? "Pip is thinking…" : "Staying with that…"}
              </Shimmer>
            )}
            {busy && <p className="px-2 text-sm text-muted-foreground">{busy}</p>}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="border-t border-border p-3">
          {child ? (
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={toggleRecording}
                disabled={Boolean(busy) || thinking}
                className={`grid size-24 place-items-center rounded-full border-2 border-ink text-ink transition-transform active:scale-95 disabled:opacity-50 ${
                  recording ? "bg-coral pulse-glow" : "bg-mustard"
                }`}
                aria-label={recording ? "Stop talking" : "Start talking"}
              >
                {recording ? <Square className="size-9" /> : <Mic className="size-9" />}
              </button>
              <span className="text-sm font-bold">
                {recording ? "Tap when you're done" : "Tap and talk"}
              </span>
            </div>
          ) : (
            <PromptInput
              onSubmit={(_message, event) => {
                event.preventDefault();
                const text = input;
                setInput("");
                void send(text);
              }}
            >
              <PromptInputTextarea
                ref={textareaRef}
                autoFocus
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Whatever's on your mind…"
              />
              <PromptInputFooter className="justify-end">
                <PromptInputSubmit status={status} disabled={!input.trim() || thinking} />
              </PromptInputFooter>
            </PromptInput>
          )}
        </div>
      </div>

      {error && <p className="mt-3 rounded-2xl bg-blush p-3 text-sm font-semibold">{error}</p>}

      {nudge && (
        <p className="mt-4 rounded-2xl border-2 border-border bg-card p-4 text-sm">
          I'm glad you're here — and I'm not a replacement for the people in your life. If this keeps
          feeling heavy, a trusted adult or{" "}
          <Link to="/therapist" className="font-bold underline">
            a therapist through Pause.
          </Link>{" "}
          can stay with it in a way I can't.
        </p>
      )}

      {latest && (
        <section className="card-soft mt-4 p-5">
          <h3 className="font-display text-lg font-bold">
            {child ? "What Pause. noticed just now" : "What Pause. noticed"}
          </h3>
          <p className="mt-1 text-sm">
            Sounds <strong>{latest.state}</strong> · {Math.round(latest.confidence * 100)}% confidence
            · {latest.energy} energy
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{latest.note}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            An observation, not a fact — and never a diagnosis. It joins the{" "}
            <Link to="/dashboard" className="font-bold underline">
              pattern view
            </Link>{" "}
            only as one small signal among many.
          </p>
        </section>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        <Link to="/dashboard">
          <PillButton variant="outline">See patterns</PillButton>
        </Link>
        {child && (
          <PillButton
            variant="outline"
            onClick={() => {
              clearVoiceData();
              setLatest(null);
            }}
          >
            <Trash2 className="size-4" aria-hidden="true" /> Delete all voice data
          </PillButton>
        )}
      </div>

      <div className="mt-5">
        <ScreeningNote />
      </div>
    </AppShell>
  );
}
