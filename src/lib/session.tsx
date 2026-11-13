import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { api } from "@/lib/api";
import type { AgeGroup } from "@/lib/games-catalog";

export type Me = {
  id: string;
  email: string | null;
  emailVerified: boolean;
  username: string;
  displayName: string;
  ageGroup: AgeGroup;
  role: "user" | "moderator" | "admin";
  guardianId: string | null;
  hasParentPin: boolean;
  bio: string;
  avatarId: string | null;
  coverId: string | null;
  avatarStyle: string;
  interests: string[];
  profileVisibility: "public" | "followers" | "private";
  phone: string;
  communityAlias: string | null;
  identityMode: "alias" | "name";
  settings: Record<string, unknown>;
  prefs: Record<string, any>;
  consented: boolean;
  memoryConsent: boolean;
  childMode: boolean;
  premium: boolean;
  createdAt: string;
};

type MeResponse = {
  user: Me | null;
  unread?: { notifications: number; messages: number };
  controls?: Record<string, any>;
};

type Ctx = {
  user: Me | null;
  loading: boolean;
  unread: { notifications: number; messages: number };
  controls: Record<string, any>;
  refresh: () => Promise<unknown>;
  logout: () => Promise<void>;
};

const SessionContext = createContext<Ctx | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => api<MeResponse>("/auth/me"),
    staleTime: 30_000,
  });
  const user = me.data?.user ?? null;

  // Keep the user's timezone current so reminders arrive at their local time.
  useEffect(() => {
    if (!user || user.childMode) return;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && user.prefs?.tz !== tz)
      void api("/me", { method: "PATCH", body: { prefs: { tz } } }).catch(() => {});
  }, [user?.id, user?.prefs?.tz]); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime: one SSE stream per signed-in tab; events invalidate the relevant queries.
  useEffect(() => {
    if (!user || typeof EventSource === "undefined") return;
    const es = new EventSource("/api/v1/events");
    const refreshMe = () => qc.invalidateQueries({ queryKey: ["me"] });
    es.addEventListener("notification", () => {
      refreshMe();
      qc.invalidateQueries({ queryKey: ["notifications"] });
    });
    es.addEventListener("message", (e) => {
      refreshMe();
      qc.invalidateQueries({ queryKey: ["conversations"] });
      try {
        const d = JSON.parse((e as MessageEvent).data);
        if (d.conversationId)
          qc.invalidateQueries({ queryKey: ["conversation", d.conversationId] });
      } catch {
        /* ignore */
      }
    });
    es.addEventListener("read", (e) => {
      try {
        const d = JSON.parse((e as MessageEvent).data);
        qc.invalidateQueries({ queryKey: ["conversation", d.conversationId] });
      } catch {
        /* ignore */
      }
    });
    return () => es.close();
  }, [user?.id, qc]);

  const value = useMemo<Ctx>(
    () => ({
      user,
      loading: me.isLoading,
      unread: me.data?.unread ?? { notifications: 0, messages: 0 },
      controls: me.data?.controls ?? {},
      refresh: () => me.refetch(),
      logout: async () => {
        await api("/auth/logout", { method: "POST" });
        qc.clear();
        window.location.href = "/";
      },
    }),
    [user, me, qc],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}

export const ageGroupLabel: Record<AgeGroup, string> = {
  early: "Ages 4–7 · with a grown-up",
  kids: "Ages 8–12",
  teen: "Ages 13–17",
  adult: "18+",
};
