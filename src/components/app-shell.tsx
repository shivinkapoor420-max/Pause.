import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Award,
  BarChart3,
  Bell,
  BookOpen,
  CreditCard,
  Flower2,
  Gamepad2,
  Heart,
  Home,
  LifeBuoy,
  LogOut,
  Menu,
  MessageCircle,
  Settings,
  Shield,
  Sparkles,
  Sprout,
  Trophy,
  Users,
  Wind,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { Tutorial } from "@/components/tutorial";
import { Avatar } from "@/components/kit";
import { useApp } from "@/lib/app-state";
import { useSession, type Me } from "@/lib/session";
import { cn } from "@/lib/utils";

type NavItem = {
  to: string;
  label: string;
  icon: typeof Home;
  badge?: "messages" | "notifications";
};

export function navFor(user: Me): NavItem[] {
  const g = user.ageGroup;
  const items: NavItem[] = [{ to: "/home", label: "Home", icon: Home }];
  if (g !== "early") items.push({ to: "/companion", label: "Pip", icon: Heart });
  if (g === "adult") {
    items.push({ to: "/community", label: "Community", icon: Users });
    items.push({ to: "/messages", label: "Messages", icon: MessageCircle, badge: "messages" });
  }
  items.push({ to: "/games", label: "Games", icon: Gamepad2 });
  items.push({ to: "/journal", label: "Journal", icon: BookOpen });
  items.push({
    to: "/tools",
    label: g === "adult" || g === "teen" ? "Mindfulness" : "Calm corner",
    icon: Wind,
  });
  items.push({ to: "/garden", label: "Garden", icon: Flower2 });
  items.push({ to: "/insights", label: "Insights", icon: BarChart3 });
  if (g === "adult") items.push({ to: "/recovery", label: "Recovery", icon: Sprout });
  items.push({ to: "/achievements", label: "Achievements", icon: Award });
  if (g === "adult") {
    items.push({ to: "/leaderboard", label: "Leaderboards", icon: Trophy });
    items.push({ to: "/family", label: "Family", icon: Sparkles });
    items.push({ to: "/billing", label: "Premium", icon: CreditCard });
  }
  items.push({ to: "/settings", label: "Settings", icon: Settings });
  if (user.role === "admin" || user.role === "moderator")
    items.push({ to: "/admin", label: "Admin", icon: Shield });
  return items;
}

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
        {child
          ? "Please tell a grown-up you trust right now"
          : "You don't have to sit with this alone"}
      </p>
      <p className="mt-1 text-sm">
        <strong>India:</strong> Tele-MANAS{" "}
        <a className="underline" href="tel:14416">
          14416
        </a>{" "}
        · <strong>US:</strong> call or text{" "}
        <a className="underline" href="tel:988">
          988
        </a>{" "}
        · <strong>UK:</strong> Samaritans{" "}
        <a className="underline" href="tel:116123">
          116 123
        </a>{" "}
        · Elsewhere:{" "}
        <a className="underline" href="https://findahelpline.com" target="_blank" rel="noreferrer">
          findahelpline.com
        </a>
        . If someone is in immediate danger, call your local emergency number.
      </p>
    </div>
  );
}

export function ScreeningNote() {
  return (
    <p className="text-sm text-muted-foreground">
      Pause. is a wellness and support tool, not a diagnosis or therapy. Patterns you see here are
      worth talking through with a licensed professional.
    </p>
  );
}

function useGuard() {
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/login", search: { next: pathname } as never });
    else if (user.childMode && !pathname.startsWith("/kid") && !pathname.startsWith("/games"))
      navigate({ to: "/kid" });
  }, [user, loading, pathname, navigate]);
  return { user, loading };
}

export function AppShell({
  children,
  title,
  wide = false,
}: {
  children: ReactNode;
  sky?: boolean;
  title?: string;
  wide?: boolean;
}) {
  const { user } = useGuard();
  const { state } = useApp();
  const { unread, logout } = useSession();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => setMoreOpen(false), [pathname]);

  if (!user) {
    return (
      <div className="grid min-h-dvh place-items-center" role="status" aria-label="Loading">
        <div className="aurora" />
        <span className="float-slow text-5xl">🌿</span>
      </div>
    );
  }

  if (user.childMode) {
    // 4–7 child mode: no navigation, no notifications — just big friendly buttons.
    return (
      <div className="relative min-h-dvh overflow-x-clip">
        <div className="aurora" aria-hidden="true" />
        <header className="mx-auto flex max-w-4xl items-center justify-between px-4 pt-4">
          <Link
            to="/kid"
            className="rounded-full border-2 border-ink bg-card px-5 py-2.5 text-lg font-black"
          >
            🏠 Home
          </Link>
          <Avatar style={user.avatarStyle} size={48} />
        </header>
        <main id="main" className="mx-auto w-full max-w-4xl px-4 pt-6 pb-16">
          {children}
        </main>
      </div>
    );
  }

  const items = navFor(user);
  const primary = items
    .filter((i) => ["/home", "/companion", "/community", "/games", "/journal"].includes(i.to))
    .slice(0, 4);
  const isActive = (to: string) =>
    pathname === to || (to !== "/home" && pathname.startsWith(`${to}/`));
  const badgeCount = (b?: NavItem["badge"]) =>
    b === "messages" ? unread.messages : b === "notifications" ? unread.notifications : 0;

  return (
    <div className="relative min-h-dvh overflow-x-clip">
      <a
        href="#main"
        className="sr-only z-50 rounded-full bg-card px-4 py-2 font-bold focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <div className="aurora" aria-hidden="true" />
      <Tutorial />

      <aside className="glass fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r px-4 py-6 lg:flex">
        <Link to="/home" className="px-3 font-display text-2xl font-black tracking-tight">
          Pause<span className="text-coral">.</span>
        </Link>
        <nav aria-label="Main" className="mt-6 flex-1 overflow-y-auto">
          <ul className="space-y-1">
            {items.map(({ to, label, icon: Icon, badge }) => (
              <li key={to}>
                <Link
                  to={to}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold transition-colors",
                    isActive(to)
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
                  <span className="flex-1">{label}</span>
                  {badgeCount(badge) > 0 && (
                    <span className="rounded-full bg-coral px-2 text-xs text-coral-foreground">
                      {badgeCount(badge)}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-muted/70 p-3">
          <Avatar style={user.avatarStyle} imageId={user.avatarId} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{user.displayName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {user.premium ? "Premium" : "Free plan"}
            </p>
          </div>
          <button
            onClick={() => void logout()}
            className="rounded-full p-2 text-muted-foreground hover:bg-card hover:text-foreground"
            aria-label="Sign out"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </aside>

      <header className="glass sticky top-0 z-20 border-b lg:pl-64">
        <div
          className={cn(
            "mx-auto flex h-14 items-center justify-between px-4",
            wide ? "max-w-6xl" : "max-w-3xl",
          )}
        >
          <Link to="/home" className="font-display text-xl font-black lg:invisible">
            Pause<span className="text-coral">.</span>
          </Link>
          <div className="flex items-center gap-1">
            {user.ageGroup === "adult" && (
              <Link
                to="/messages"
                className="relative rounded-full p-2.5 hover:bg-muted"
                aria-label={`Messages${unread.messages ? `, ${unread.messages} unread` : ""}`}
              >
                <MessageCircle className="size-5" />
                {unread.messages > 0 && (
                  <span className="absolute top-1 right-1 size-2.5 rounded-full bg-coral" />
                )}
              </Link>
            )}
            <Link
              to="/notifications"
              className="relative rounded-full p-2.5 hover:bg-muted"
              aria-label={`Notifications${unread.notifications ? `, ${unread.notifications} unread` : ""}`}
            >
              <Bell className="size-5" />
              {unread.notifications > 0 && (
                <span className="absolute top-0.5 right-0.5 grid min-w-4 place-items-center rounded-full bg-coral px-1 text-[10px] font-black text-coral-foreground">
                  {unread.notifications > 9 ? "9+" : unread.notifications}
                </span>
              )}
            </Link>
            <Link to="/settings" className="ml-1 rounded-full" aria-label="Settings">
              <Avatar style={user.avatarStyle} imageId={user.avatarId} size={34} />
            </Link>
          </div>
        </div>
      </header>

      <div className="lg:pl-64">
        <main
          id="main"
          className={cn(
            "relative mx-auto w-full px-4 pt-6 pb-32 sm:px-6 lg:pb-16",
            wide ? "max-w-6xl" : "max-w-3xl",
          )}
        >
          {title && <h1 className="sr-only">{title}</h1>}
          {state.riskFlagged && (
            <div className="mb-5">
              <CrisisBanner compact />
            </div>
          )}
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </main>
      </div>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border lg:hidden"
        style={{ background: "var(--nav-bg)", backdropFilter: "blur(14px)" }}
      >
        <ul className="mx-auto flex max-w-xl items-stretch justify-between px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {primary.map(({ to, label, icon: Icon, badge }) => (
            <li key={to} className="flex-1">
              <Link
                to={to}
                className={cn(
                  "relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-[11px] font-bold transition-colors",
                  isActive(to) ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                {label}
                {badgeCount(badge) > 0 && (
                  <span className="absolute top-1 right-3 size-2 rounded-full bg-coral" />
                )}
              </Link>
            </li>
          ))}
          <li className="flex-1">
            <button
              onClick={() => setMoreOpen(true)}
              className="flex min-h-12 w-full flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-bold text-muted-foreground"
              aria-expanded={moreOpen}
            >
              <Menu className="size-5" aria-hidden="true" />
              More
            </button>
          </li>
        </ul>
      </nav>

      <AnimatePresence>
        {moreOpen && (
          <motion.div
            className="fixed inset-0 z-40 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              className="absolute inset-0 bg-ink/30"
              aria-label="Close menu"
              onClick={() => setMoreOpen(false)}
            />
            <motion.div
              role="dialog"
              aria-label="All sections"
              className="absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto rounded-t-3xl bg-card p-5 pb-8"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", bounce: 0.1, duration: 0.4 }}
            >
              <div className="mb-4 flex items-center justify-between">
                <p className="font-display text-xl font-bold">Everything in Pause</p>
                <button
                  onClick={() => setMoreOpen(false)}
                  className="rounded-full p-2 hover:bg-muted"
                  aria-label="Close"
                >
                  <X className="size-5" />
                </button>
              </div>
              <ul className="grid grid-cols-3 gap-2">
                {items.map(({ to, label, icon: Icon }) => (
                  <li key={to}>
                    <Link
                      to={to}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-2xl p-3 text-center text-xs font-bold",
                        isActive(to) ? "bg-primary text-primary-foreground" : "bg-muted",
                      )}
                    >
                      <Icon className="size-6" aria-hidden="true" />
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => void logout()}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-border p-3 text-sm font-bold"
              >
                <LogOut className="size-4" /> Sign out
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function PillButton({
  children,
  variant = "primary",
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "coral" | "outline" | "forest" | "ghost";
}) {
  return (
    <button
      {...rest}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-6 py-3 text-base font-bold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift active:translate-y-0 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" &&
          "border-2 border-ink bg-primary text-primary-foreground hover:brightness-105",
        variant === "coral" &&
          "border-2 border-ink bg-coral text-coral-foreground hover:brightness-105",
        variant === "forest" && "bg-forest text-forest-foreground hover:brightness-110",
        variant === "outline" && "border-2 border-ink bg-card text-foreground hover:bg-muted",
        variant === "ghost" && "text-foreground hover:bg-muted",
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
          : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
