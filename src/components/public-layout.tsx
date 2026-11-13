import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useSession } from "@/lib/session";

export function PublicLayout({ children }: { children: ReactNode }) {
  const { user } = useSession();
  return (
    <div className="relative flex min-h-dvh flex-col">
      <div className="aurora" aria-hidden="true" />
      <header className="sticky top-0 z-20">
        <div className="glass mx-auto mt-3 flex max-w-6xl items-center justify-between rounded-full px-4 py-2 sm:mx-4 lg:mx-auto">
          <Link to="/" className="px-2 font-display text-2xl font-black tracking-tight">
            Pause<span className="text-coral">.</span>
          </Link>
          <nav aria-label="Site" className="flex items-center gap-1 text-sm font-bold">
            <Link to="/about" className="hidden rounded-full px-3 py-2 hover:bg-muted sm:block">
              About
            </Link>
            <Link to="/blog" className="hidden rounded-full px-3 py-2 hover:bg-muted sm:block">
              Blog
            </Link>
            <Link to="/pricing" className="hidden rounded-full px-3 py-2 hover:bg-muted md:block">
              Pricing
            </Link>
            <Link to="/contact" className="hidden rounded-full px-3 py-2 hover:bg-muted md:block">
              Contact
            </Link>
            {user ? (
              <Link
                to={user.childMode ? "/kid" : "/home"}
                className="rounded-full bg-forest px-4 py-2 text-forest-foreground"
              >
                Open Pause
              </Link>
            ) : (
              <>
                <Link to="/login" className="rounded-full px-3 py-2 hover:bg-muted">
                  Sign in
                </Link>
                <Link
                  to="/signup"
                  className="rounded-full bg-forest px-4 py-2 text-forest-foreground"
                >
                  Get started
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main id="main" className="flex-1">
        {children}
      </main>
      <footer className="mt-20 border-t border-border bg-card/60">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <p className="font-display text-2xl font-black">
              Pause<span className="text-coral">.</span>
            </p>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              A gentle mental-wellness space for every age. Pause is not a medical service and does
              not provide diagnosis or therapy. If you're in crisis, contact your local emergency
              number or a helpline such as Tele-MANAS (India) 14416, 988 (US) or Samaritans (UK) 116
              123.
            </p>
          </div>
          <div>
            <p className="text-sm font-bold">Product</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li>
                <Link to="/about" className="hover:text-foreground">
                  About us
                </Link>
              </li>
              <li>
                <Link to="/blog" className="hover:text-foreground">
                  Community blog
                </Link>
              </li>
              <li>
                <Link to="/pricing" className="hover:text-foreground">
                  Pricing
                </Link>
              </li>
              <li>
                <Link to="/signup" className="hover:text-foreground">
                  Create account
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-foreground">
                  Sign in
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-bold">Help</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li>
                <Link to="/contact" className="hover:text-foreground">
                  Contact us
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="hover:text-foreground">
                  Privacy & safety
                </Link>
              </li>
              <li>
                <Link to="/community/guidelines" className="hover:text-foreground">
                  Community guidelines
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <p className="pb-8 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Pause. Made with care.
        </p>
      </footer>
    </div>
  );
}
