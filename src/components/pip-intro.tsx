import { Mic } from "lucide-react";
import { useEffect, useState } from "react";
import { PillButton } from "@/components/app-shell";
import { Companion } from "@/components/companion-character";
import { WeatherIcon } from "@/components/illustrations";
import { useApp } from "@/lib/app-state";

/**
 * Pip's own hello for the 4–10 track — narrated aloud, because many children this
 * age aren't reading fluently yet. Three short beats, nothing abstract: just
 * meeting a friend and learning the two things they'll actually touch.
 */
const beats = [
  { say: "Hi! I'm Pip. I'm your friend in here.", show: "pip" },
  { say: "You can tap the one that matches how you feel today.", show: "faces" },
  { say: "And you can talk to me any time — just press the big button.", show: "mic" },
] as const;

export function PipIntro() {
  const { state, ready, update } = useApp();
  const [i, setI] = useState(0);
  const beat = beats[Math.min(i, beats.length - 1)]!;
  const active = ready && state.consented && state.band === "child" && !state.pipIntroDone;

  useEffect(() => {
    if (!active || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(beat.say);
    utterance.rate = 0.92;
    utterance.pitch = 1.25;
    window.speechSynthesis.speak(utterance);
    return () => window.speechSynthesis.cancel();
  }, [active, beat.say]);

  if (!active) return null;

  const finish = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window)
      window.speechSynthesis.cancel();
    update({ pipIntroDone: true });
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-5"
      role="dialog"
      aria-label="Meet Pip"
    >
      <div className="absolute inset-0 bg-ink/60" onClick={finish} />
      <div className="card-soft ink-outline relative w-full max-w-sm p-6 text-center">
        <Companion className="mx-auto size-28 text-forest" state="listening" />
        <p className="mt-4 font-display text-2xl leading-snug font-black">{beat.say}</p>

        {beat.show === "faces" && (
          <div className="mt-5 grid grid-cols-3 gap-3">
            {(["sunny", "cloudy", "rainy"] as const).map((sky) => (
              <span
                key={sky}
                className="grid aspect-square place-items-center rounded-3xl border-2 border-ink bg-mustard/70 p-2"
              >
                <WeatherIcon sky={sky} className="size-12 text-ink" />
              </span>
            ))}
          </div>
        )}

        {beat.show === "mic" && (
          <span className="mt-5 grid size-24 place-items-center rounded-full border-2 border-ink bg-mustard mx-auto pulse-glow">
            <Mic className="size-9" aria-hidden="true" />
          </span>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          <button onClick={finish} className="text-sm font-bold text-muted-foreground underline">
            Skip
          </button>
          <PillButton
            variant="coral"
            onClick={() => (i === beats.length - 1 ? finish() : setI(i + 1))}
          >
            {i === beats.length - 1 ? "Okay!" : "Next"}
          </PillButton>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Pip is an AI friend, not a person. Grown-up? The caregiver briefing follows this.
        </p>
      </div>
    </div>
  );
}
