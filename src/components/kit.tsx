import { motion } from "motion/react";
import type { ReactNode } from "react";
import { mediaUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

export const avatarStyles: Record<string, { emoji: string; hue: number; label: string }> = {
  leaf: { emoji: "🌿", hue: 140, label: "Leaf" },
  sun: { emoji: "🌞", hue: 75, label: "Sun" },
  moon: { emoji: "🌙", hue: 270, label: "Moon" },
  wave: { emoji: "🌊", hue: 215, label: "Wave" },
  star: { emoji: "⭐", hue: 55, label: "Star" },
  cloud: { emoji: "☁️", hue: 230, label: "Cloud" },
  flower: { emoji: "🌸", hue: 345, label: "Flower" },
  mountain: { emoji: "⛰️", hue: 180, label: "Mountain" },
  fox: { emoji: "🦊", hue: 35, label: "Fox" },
  owl: { emoji: "🦉", hue: 25, label: "Owl" },
  cat: { emoji: "🐱", hue: 50, label: "Cat" },
  panda: { emoji: "🐼", hue: 0, label: "Panda" },
  butterfly: { emoji: "🦋", hue: 250, label: "Butterfly" },
  turtle: { emoji: "🐢", hue: 120, label: "Turtle" },
  rocket: { emoji: "🚀", hue: 290, label: "Rocket" },
  headphones: { emoji: "🎧", hue: 310, label: "Music" },
  anon: { emoji: "🫥", hue: 260, label: "Anonymous" },
};

export function Avatar({
  style,
  imageId,
  size = 40,
  className,
  online,
}: {
  style?: string | null;
  imageId?: string | null;
  size?: number;
  className?: string;
  online?: boolean;
}) {
  const s = avatarStyles[style ?? "leaf"] ?? avatarStyles["leaf"]!;
  return (
    <span
      className={cn("relative inline-grid shrink-0 place-items-center rounded-full", className)}
      style={{ width: size, height: size }}
    >
      {imageId ? (
        <img src={mediaUrl(imageId)} alt="" className="size-full rounded-full object-cover" />
      ) : (
        <span
          aria-hidden="true"
          className="grid size-full place-items-center rounded-full border border-border"
          style={{
            background: `linear-gradient(135deg, oklch(0.9 0.08 ${s.hue}), oklch(0.8 0.12 ${s.hue + 40}))`,
            fontSize: size * 0.5,
          }}
        >
          {s.emoji}
        </span>
      )}
      {online && (
        <span
          className="absolute right-0 bottom-0 size-3 rounded-full border-2 border-card bg-green-500"
          aria-label="Online"
        />
      )}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
  eyebrow,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-sm font-bold tracking-wide text-forest uppercase">{eyebrow}</p>
        )}
        <h1 className="font-display text-3xl leading-tight font-black tracking-tight sm:text-4xl">
          {title}
        </h1>
        {subtitle && <p className="mt-2 max-w-xl text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function Card({
  children,
  className,
  as: As = "section",
  ...rest
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article" | "li";
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <As className={cn("card-soft p-5", className)} {...rest}>
      {children}
    </As>
  );
}

export function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-2xl", className)} aria-hidden="true" />;
}

export function LoadingCards({ n = 3 }: { n?: number }) {
  return (
    <div className="grid gap-4" role="status" aria-label="Loading">
      {Array.from({ length: n }, (_, i) => (
        <Skeleton key={i} className="h-28" />
      ))}
    </div>
  );
}

export function EmptyState({
  emoji,
  title,
  body,
  action,
}: {
  emoji: string;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card-soft flex flex-col items-center px-6 py-12 text-center">
      <span className="float-slow text-5xl" aria-hidden="true">
        {emoji}
      </span>
      <h3 className="mt-4 font-display text-xl font-bold">{title}</h3>
      {body && <p className="mt-2 max-w-sm text-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && !error && <span className="mt-1.5 block text-xs text-muted-foreground">{hint}</span>}
      {error && <span className="mt-1.5 block text-xs font-bold text-destructive">{error}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-2xl border-2 border-border bg-muted px-4 py-3 text-base font-semibold text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-ring";

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <p className="font-bold">{label}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full border-2 border-ink transition-colors disabled:opacity-50",
          checked ? "bg-forest" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-card shadow transition-all",
            checked ? "left-6" : "left-0.5",
          )}
        />
      </button>
    </div>
  );
}

export function Tabs<T extends string>({
  value,
  onChange,
  items,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { id: T; label: ReactNode }[];
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex gap-1 overflow-x-auto rounded-full border border-border bg-card/70 p-1",
        className,
      )}
    >
      {items.map((it) => (
        <button
          key={it.id}
          role="tab"
          aria-selected={value === it.id}
          onClick={() => onChange(it.id)}
          className={cn(
            "relative shrink-0 rounded-full px-4 py-2 text-sm font-bold transition-colors",
            value === it.id
              ? "text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {value === it.id && (
            <motion.span
              layoutId={`tab-${items.map((i) => i.id).join()}`}
              className="absolute inset-0 rounded-full bg-primary"
              transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
            />
          )}
          <span className="relative">{it.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Badge({
  children,
  tone = "muted",
  className,
}: {
  children: ReactNode;
  tone?: "muted" | "premium" | "forest" | "coral" | "lavender";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold",
        tone === "muted" && "bg-muted text-muted-foreground",
        tone === "premium" && "bg-mustard text-foreground",
        tone === "forest" && "bg-forest text-forest-foreground",
        tone === "coral" && "bg-coral text-coral-foreground",
        tone === "lavender" && "bg-lavender text-secondary-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function ProgressRing({
  value,
  size = 64,
  stroke = 7,
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-muted)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-forest)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - Math.max(0, Math.min(1, value))) }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      <span className="absolute text-sm font-black">{children}</span>
    </div>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p
      role="alert"
      className="rounded-2xl border-2 border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-bold text-destructive"
    >
      {error instanceof Error ? error.message : String(error)}
    </p>
  );
}
