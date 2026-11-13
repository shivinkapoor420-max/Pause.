import { cn } from "@/lib/utils";

/**
 * Pip — one companion character, shared by the Voice Companion (4–10) and the
 * Listening Companion (11+). A small friendly creature in the app's linework
 * style, deliberately not a human face.
 */
export function Companion({
  className,
  state = "idle",
}: {
  className?: string;
  state?: "idle" | "listening" | "thinking";
}) {
  return (
    <div className={cn("relative", className)}>
      <svg viewBox="0 0 120 120" className={cn("size-full breathe")} aria-hidden="true">
        <g fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
          {/* body */}
          <path d="M60 20c19 0 32 15 32 34 0 22-14 40-32 40S28 76 28 54c0-19 13-34 32-34z" />
          {/* antenna */}
          <path d="M60 20v-9" />
          <circle cx="60" cy="8" r="4" />
          {/* eyes */}
          <path d="M48 52c1.6 0 2.6 1.6 2.6 3.4S49.6 59 48 59s-2.6-1.6-2.6-3.6S46.4 52 48 52z" />
          <path d="M72 52c1.6 0 2.6 1.6 2.6 3.4S73.6 59 72 59s-2.6-1.6-2.6-3.6S70.4 52 72 52z" />
          {/* mouth */}
          {state === "listening" ? (
            <circle cx="60" cy="70" r="5" />
          ) : (
            <path d="M53 69c3 4 11 4 14 0" />
          )}
          {/* little feet */}
          <path d="M48 94v6M72 94v6" />
          {/* leafy tuft, echoing the app's sprig motif */}
          <path d="M88 40c6-4 12-3 16 0-4 5-11 6-16 3" />
        </g>
      </svg>
      {state === "thinking" && (
        <span className="absolute inset-x-0 -bottom-1 mx-auto block h-1 w-10 rounded-full bg-forest/40 sparkle" />
      )}
      <span className="sr-only">Pip, your AI companion</span>
    </div>
  );
}
