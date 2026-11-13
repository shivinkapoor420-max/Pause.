import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, Heart, Home, LifeBuoy, Sparkles, User } from "lucide-react";
import type { ReactNode } from "react";
import { Tutorial } from "@/components/tutorial";
import { useApp } from "@/lib/app-state";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/companion", label: "Pip", icon: Heart },
  { to: "/journal", label: "Journal", icon: BookOpen },
  { to: "/tools", label: "Coping", icon: Sparkles },
  { to: "/profile", label: "Profile", icon: User },
] as const;



export function CalmToggle() {
  const { state, setSettings } = useApp();
  const calm = state.settings.calmMode;
  return (
    <button
      onClick={() => setSettings({ calmMode: !calm })}
      className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-card px-4 py-2 text-sm font-bold text-foreground"
    >
      <span aria-hidden="true">{calm ? "→" : "←"}</span>
      {calm ? "Normal view" : "Calm mode"}
    </button>
  );
}

export function CrisisBanner({ compact = false }: { compact?: boolean }) {
  const { state } = useApp();
  const child = state.band === "child";
  return (
    <div
      className={cn(
        "rounded-2xl border-2 border-ink bg-coral/70 p-4 text-coral-foreground",
        compact && "p-3",
      )}
    >
      <p className="flex items-center gap-2 font-bold">
        <LifeBuoy className="size-5" aria-hidden="true" />
        {child ? "Caregiver: this needs your attention today" : "You don't have to sit with this alone"}
      </p>
      <p className="mt-1 text-sm">
        Call or text <strong>988</strong> (Suicide &amp; Crisis Lifeline, US) any time, day or night.
        Text <strong>HOME</strong> to <strong>741741</strong> to reach a crisis counselor. If someone
        is in immediate danger, call 911.
      </p>
    </div>
  );
}

export function ScreeningNote() {
  return (
    <p className="text-sm text-muted-foreground">
      Pause. is a screening and support tool, not a diagnosis. Patterns you see here are worth
      talking through with a licensed professional.
    </p>
  );
}

export function AppShell({
  children,
  sky = true,
  title,
}: {
  children: ReactNode;
  sky?: boolean;
  title?: string;
}) {
  const { state } = useApp();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="relative min-h-dvh overflow-hidden pb-28">
      <Tutorial />
      {sky && (
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[60vh]">
          <div className="sky-wash drift" />
        </div>
      )}
      <main className="mx-auto w-full max-w-2xl px-5 pt-7">
        {title && <h1 className="sr-only">{title}</h1>}

        {state.riskFlagged && (
          <div className="mb-5">
            <CrisisBanner compact />
          </div>
        )}
        {children}
      </main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur"
      >
        <ul className="mx-auto flex max-w-2xl items-stretch justify-between px-4 py-2">
          {tabs.map(({ to, label, icon: Icon }) => {
            const active = pathname === to;
            return (
              <li key={to} className="flex-1">
                <Link
                  to={to}
                  className={cn(
                    "flex min-h-11 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-xs font-bold transition-colors",
                    active ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

export function PillButton({
  children,
  variant = "primary",
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "coral" | "outline" | "forest";
}) {
  return (
    <button
      {...rest}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-6 py-3 text-base font-bold transition-transform active:scale-[0.98] disabled:opacity-50",
        variant === "primary" && "border-2 border-ink bg-primary text-primary-foreground",
        variant === "coral" && "border-2 border-ink bg-coral text-coral-foreground",
        variant === "forest" && "bg-forest text-forest-foreground",
        variant === "outline" && "border-2 border-ink bg-card text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Chip({
  active,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      {...rest}
      aria-pressed={active}
      className={cn(
        "min-h-11 rounded-full border-2 px-4 py-2 text-sm font-bold transition-colors",
        active
          ? "border-ink bg-mustard text-foreground"
          : "border-border bg-card text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}
