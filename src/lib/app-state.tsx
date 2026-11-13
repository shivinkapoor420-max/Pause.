import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { AgeGroup } from "@/lib/games-catalog";

export type AgeBand = "child" | "teen" | "adult";
export type Sky = "sunny" | "partly" | "cloudy" | "rainy" | "stormy";

export type MoodEntry = {
  date: string; // yyyy-mm-dd
  sky: Sky;
  tags: string[];
};

export type JournalEntry = {
  id: string;
  date: string;
  kind: "text" | "voice" | "drawing";
  prompt: string;
  body: string;
  sky?: Sky | undefined;
};

export type CheckinRecord = {
  id: string;
  date: string;
  band: AgeBand;
  answers: Record<string, number>;
  flagged: boolean;
};

/** Estimated emotional states — always observations, never facts. */
export type EmotionState =
  | "happy"
  | "excited"
  | "calm"
  | "curious"
  | "nervous"
  | "sad"
  | "frustrated"
  | "angry"
  | "fearful"
  | "overwhelmed"
  | "withdrawn"
  | "confused";

export type CompanionObservation = {
  at: string;
  state: EmotionState;
  confidence: number; // 0–1
  energy: "low" | "steady" | "high";
  engagement: "low" | "steady" | "high";
  note: string;
  snippet?: string | undefined;
};

export type CompanionTurn = {
  role: "user" | "companion";
  text: string;
  at: string;
};

export type CompanionSession = {
  id: string;
  date: string;
  band: AgeBand;
  mode: "voice" | "text";
  turns: CompanionTurn[];
  observations: CompanionObservation[];
};

/**
 * Adaptive accessibility profile. Every axis is independent — someone can want
 * zero motion with full colour, or full ambient sound with a simplified layout.
 * "Calm mode" is a preset that sets sensible values across all of them.
 */
export type Settings = {
  calmMode: boolean;
  textScale: number;
  dyslexiaFont: boolean;
  speech: boolean;
  motion: "none" | "reduced" | "full";
  colorIntensity: "muted" | "standard" | "vivid";
  sound: "off" | "minimal" | "full";
  layout: "single-focus" | "standard";
  screenReader: boolean;
  /** Grounding Room: how the breathing element moves for motion-sensitive people. */
  breathCue: "scale" | "color";
};

export const calmPreset: Partial<Settings> = {
  motion: "none",
  colorIntensity: "muted",
  sound: "off",
  layout: "single-focus",
  breathCue: "color",
};

export const fullPreset: Partial<Settings> = {
  motion: "full",
  colorIntensity: "standard",
  sound: "minimal",
  layout: "standard",
  breathCue: "scale",
};

/** A therapist who signed up for the partner network, stored on this device. */
export type PortalTherapist = {
  name: string;
  email: string;
  license: string;
  licenseState: string;
  practice: string;
  acceptsBriefs: boolean;
  verifiedAt: string;
};

/** A single picture step in a young child's visual routine. */
export type RoutineStep = {
  id: string;
  label: string;
  icon: RoutineIcon;
};

export type RoutineIcon =
  | "wake"
  | "breakfast"
  | "teeth"
  | "dress"
  | "school"
  | "play"
  | "snack"
  | "dinner"
  | "bath"
  | "story"
  | "bed"
  | "quiet";

/** Teen band only: what a caregiver can see, if one is invited at all. */
export type TeenPrivacy = {
  caregiverInvited: boolean;
  /** Trend summaries only — raw entries and transcripts are never shared. */
  shareTrends: boolean;
};

export type TherapistNote = {
  contacted: boolean;
  note: string;
};

export type AppState = {
  name: string;
  band: AgeBand | null;
  /** Fine-grained age group from the server: early (4–7), kids (8–12), teen, adult. */
  ageGroup: AgeGroup | null;
  caregiverName: string;
  /** Caregiver's number for child profiles, the person's own for teens/adults. Optional. */
  phone: string;
  smsReminders: boolean;
  consented: boolean;
  /** Verifiable parental consent for recording / tone reading (child band). */
  voiceConsent: boolean;
  /** Consent to keep short transcript snippets in the caregiver view. */
  snippetConsent: boolean;
  startedOn: string | null;
  /** Whether the on-screen walkthrough has been completed or skipped. */
  tutorialDone: boolean;
  /** Pip's own spoken hello for the 4–10 track. */
  pipIntroDone: boolean;
  /** Progressive disclosure: how many deeper-check-in questions have been introduced. */
  questionsUnlocked: number;
  moods: MoodEntry[];
  journal: JournalEntry[];
  checkins: CheckinRecord[];
  companion: CompanionSession[];
  toolUse: Record<string, number>;
  settings: Settings;
  teenPrivacy: TeenPrivacy;
  routine: RoutineStep[];
  /** yyyy-mm-dd → step ids ticked off that day. */
  routineDone: Record<string, string[]>;
  /** Private, per-therapist notes and a "contacted" marker. Never leaves the device. */
  therapistNotes: Record<string, TherapistNote>;
  riskFlagged: boolean;
  /** Briefs and updates shared with partner-network therapists, kept on-device. */
  sentBriefs: {
    at: string;
    therapistId: string;
    therapistName: string;
    kind?: "brief" | "update";
  }[];
  /** Therapist-side portal account, if this device signed up as a therapist. */
  portal: PortalTherapist | null;
  /** Briefs the portal has confirmed receipt of: sentBrief `at` → confirmed ISO date. */
  portalReceipts: Record<string, string>;
  /** Grounding Room sessions, feeding the Growth Garden. */
  groundingSessions: { at: string; theme: string; breaths: number }[];
};

export const defaultRoutine: RoutineStep[] = [
  { id: "r-wake", label: "Wake up", icon: "wake" },
  { id: "r-breakfast", label: "Breakfast", icon: "breakfast" },
  { id: "r-teeth", label: "Brush teeth", icon: "teeth" },
  { id: "r-school", label: "School", icon: "school" },
  { id: "r-dinner", label: "Dinner", icon: "dinner" },
  { id: "r-bath", label: "Bath", icon: "bath" },
  { id: "r-bed", label: "Bedtime", icon: "bed" },
];

const initialState: AppState = {
  name: "",
  band: null,
  ageGroup: null,
  caregiverName: "",
  phone: "",
  smsReminders: false,
  consented: false,
  voiceConsent: false,
  snippetConsent: false,
  startedOn: null,
  tutorialDone: false,
  pipIntroDone: false,
  questionsUnlocked: 4,
  moods: [],
  journal: [],
  checkins: [],
  companion: [],
  toolUse: {},
  settings: {
    calmMode: false,
    textScale: 1,
    dyslexiaFont: false,
    speech: false,
    motion: "full",
    colorIntensity: "standard",
    sound: "minimal",
    layout: "standard",
    screenReader: false,
    breathCue: "scale",
  },
  teenPrivacy: { caregiverInvited: false, shareTrends: false },
  routine: defaultRoutine,
  routineDone: {},
  therapistNotes: {},
  riskFlagged: false,
  sentBriefs: [],
  portal: null,
  portalReceipts: {},
  groundingSessions: [],
};

type Ctx = {
  state: AppState;
  ready: boolean;
  update: (patch: Partial<AppState>) => void;
  setMood: (sky: Sky, tags: string[]) => void;
  addJournal: (entry: Omit<JournalEntry, "id" | "date">) => void;
  addCheckin: (record: Omit<CheckinRecord, "id" | "date">) => void;
  useTool: (id: string) => void;
  setSettings: (patch: Partial<Settings>) => void;
  startCompanionSession: (mode: "voice" | "text") => string;
  addCompanionTurn: (sessionId: string, turn: Omit<CompanionTurn, "at">) => void;
  addCompanionObservation: (sessionId: string, obs: Omit<CompanionObservation, "at">) => void;
  flagRisk: () => void;
  clearVoiceData: () => void;
  toggleRoutineStep: (stepId: string) => void;
  setRoutine: (steps: RoutineStep[]) => void;
  setTherapistNote: (therapistId: string, patch: Partial<TherapistNote>) => void;
  logGrounding: (theme: string, breaths: number) => void;
  confirmBriefReceipt: (at: string) => void;
  reset: () => void;
  logActivity: (kind: string, ref: string, meta?: Record<string, unknown>) => void;
};

const AppStateContext = createContext<Ctx | null>(null);

export function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Keys kept in the server-side private `app_data` blob (small UI extras). */
const blobKeys = [
  "caregiverName",
  "smsReminders",
  "voiceConsent",
  "snippetConsent",
  "startedOn",
  "tutorialDone",
  "pipIntroDone",
  "questionsUnlocked",
  "routine",
  "routineDone",
  "therapistNotes",
  "sentBriefs",
  "portal",
  "portalReceipts",
  "teenPrivacy",
] as const;

const bandFor = (g: AgeGroup): AgeBand => (g === "early" || g === "kids" ? "child" : g);

function send(path: string, body?: unknown, method?: string) {
  void api(path, { ...(body !== undefined ? { body } : {}), ...(method ? { method } : {}) }).catch(
    (e) => {
      console.warn("[pause] save failed", path, e);
      toast.error(e instanceof Error ? e.message : "Couldn't save — check your connection.");
    },
  );
}

/**
 * App state is now backed by the Pause server. The signed-in account is the
 * source of truth; this provider hydrates from /api/v1/me/state and writes
 * every change back through the API. Nothing important lives in localStorage.
 */
export function AppStateProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const [state, setState] = useState<AppState>(initialState);
  const [ready, setReady] = useState(false);
  const dirtySessions = useRef(new Set<string>());
  const stateRef = useRef(state);
  stateRef.current = state;
  const blobTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) {
      setState(initialState);
      setReady(true);
      return;
    }
    let alive = true;
    setReady(false);
    api<any>("/me/state")
      .then((remote) => {
        if (!alive) return;
        const extras = (remote.appData ?? {}) as Partial<AppState>;
        setState({
          ...initialState,
          ...extras,
          name: user.displayName,
          phone: user.phone,
          band: bandFor(user.ageGroup),
          ageGroup: user.ageGroup,
          consented: user.consented,
          moods: remote.moods,
          journal: remote.journal,
          checkins: remote.checkins,
          companion: remote.companion,
          toolUse: remote.toolUse,
          groundingSessions: remote.groundingSessions,
          riskFlagged: remote.riskFlagged,
          settings: { ...initialState.settings, ...(user.settings as Partial<Settings>) },
          teenPrivacy: {
            caregiverInvited: !!user.guardianId,
            shareTrends: user.prefs?.shareTrendsWithGuardian === true,
          },
          startedOn: extras.startedOn ?? user.createdAt.slice(0, 10),
        });
      })
      .catch(() =>
        setState({
          ...initialState,
          band: bandFor(user.ageGroup),
          ageGroup: user.ageGroup,
          name: user.displayName,
        }),
      )
      .finally(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, [user?.id]);

  // Accessibility + age theming applied to <html>.
  useEffect(() => {
    const root = document.documentElement;
    const s = state.settings;
    root.classList.toggle("calm", s.calmMode);
    root.classList.toggle("dyslexic", s.dyslexiaFont);
    root.classList.toggle("motion-none", s.motion === "none");
    root.classList.toggle("motion-reduced", s.motion === "reduced");
    root.classList.toggle("color-muted", s.colorIntensity === "muted");
    root.classList.toggle("color-vivid", s.colorIntensity === "vivid");
    root.classList.toggle("layout-single", s.layout === "single-focus");
    root.style.setProperty("--root-font-size", `${Math.round(s.textScale * 100)}%`);
    root.dataset["age"] = user?.ageGroup ?? "public";
    root.dataset["theme"] = (user?.prefs?.theme as string) || "meadow";
  }, [state.settings, user?.ageGroup, user?.prefs?.theme]);

  const value = useMemo<Ctx>(() => {
    const scheduleBlob = () => {
      if (blobTimer.current) clearTimeout(blobTimer.current);
      blobTimer.current = setTimeout(() => {
        const s = stateRef.current;
        const appData: Record<string, unknown> = {};
        for (const k of blobKeys) appData[k] = s[k];
        send("/me", { appData }, "PATCH");
      }, 600);
    };
    const scheduleSessions = () => {
      if (sessionTimer.current) clearTimeout(sessionTimer.current);
      sessionTimer.current = setTimeout(() => {
        for (const id of dirtySessions.current) {
          const sess = stateRef.current.companion.find((c) => c.id === id);
          if (sess)
            send(
              `/companion/sessions/${id}`,
              { turns: sess.turns, observations: sess.observations },
              "PATCH",
            );
        }
        dirtySessions.current.clear();
      }, 1200);
    };
    const update = (patch: Partial<AppState>) => {
      setState((s) => ({ ...s, ...patch }));
      if (patch.name !== undefined || patch.phone !== undefined) {
        send(
          "/me",
          {
            ...(patch.name ? { displayName: patch.name } : {}),
            ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
          },
          "PATCH",
        );
      }
      if (patch.teenPrivacy && user?.ageGroup === "teen")
        send("/me/guardian-sharing", { share: patch.teenPrivacy.shareTrends });
      if (patch.companion && patch.companion.length === 0)
        send("/companion/sessions", undefined, "DELETE");
      if (patch.journal && patch.journal.length === 0)
        for (const j of stateRef.current.journal) send(`/journal/${j.id}`, undefined, "DELETE");
      if (blobKeys.some((k) => k in patch)) scheduleBlob();
    };
    const patchSession = (id: string, fn: (s: CompanionSession) => CompanionSession) => {
      setState((s) => ({ ...s, companion: s.companion.map((c) => (c.id === id ? fn(c) : c)) }));
      dirtySessions.current.add(id);
      scheduleSessions();
    };
    const logActivity = (kind: string, ref: string, meta?: Record<string, unknown>) =>
      send("/activity", { kind, ref, ...(meta ? { meta } : {}) });

    return {
      state,
      ready,
      update,
      logActivity,
      setMood: (sky, tags) => {
        setState((s) => ({
          ...s,
          moods: [...s.moods.filter((m) => m.date !== today()), { date: today(), sky, tags }],
        }));
        send("/moods", { sky, tags });
      },
      addJournal: (entry) => {
        const tempId = crypto.randomUUID();
        setState((s) => ({
          ...s,
          journal: [{ ...entry, id: tempId, date: new Date().toISOString() }, ...s.journal],
        }));
        void api<{ id: string }>("/journal", {
          body: {
            kind: entry.kind,
            prompt: entry.prompt,
            body: entry.body,
            ...(entry.sky ? { sky: entry.sky } : {}),
          },
        })
          .then((r) =>
            setState((s) => ({
              ...s,
              journal: s.journal.map((j) => (j.id === tempId ? { ...j, id: r.id } : j)),
            })),
          )
          .catch((e) => toast.error(e.message));
      },
      addCheckin: (record) => {
        setState((s) => ({
          ...s,
          riskFlagged: s.riskFlagged || record.flagged,
          checkins: [
            { ...record, id: crypto.randomUUID(), date: new Date().toISOString() },
            ...s.checkins,
          ],
        }));
        send("/checkins", record);
      },
      useTool: (id) => {
        setState((s) => ({ ...s, toolUse: { ...s.toolUse, [id]: (s.toolUse[id] ?? 0) + 1 } }));
        logActivity("tool", id);
      },
      setSettings: (patch) => {
        setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
        if (user) send("/me", { settings: patch }, "PATCH");
      },
      startCompanionSession: (mode) => {
        const id = crypto.randomUUID();
        const band = stateRef.current.band ?? "adult";
        setState((s) => ({
          ...s,
          companion: [
            { id, date: new Date().toISOString(), band, mode, turns: [], observations: [] },
            ...s.companion,
          ],
        }));
        if (user) send("/companion/sessions", { id, band, mode });
        return id;
      },
      addCompanionTurn: (id, turn) =>
        patchSession(id, (c) => ({
          ...c,
          turns: [...c.turns, { ...turn, at: new Date().toISOString() }],
        })),
      addCompanionObservation: (id, obs) =>
        patchSession(id, (c) => ({
          ...c,
          observations: [...c.observations, { ...obs, at: new Date().toISOString() }],
        })),
      flagRisk: () => setState((s) => ({ ...s, riskFlagged: true })),
      clearVoiceData: () => {
        setState((s) => ({ ...s, companion: [] }));
        send("/companion/sessions", undefined, "DELETE");
      },
      toggleRoutineStep: (stepId) => {
        setState((s) => {
          const key = today();
          const done = s.routineDone[key] ?? [];
          return {
            ...s,
            routineDone: {
              ...s.routineDone,
              [key]: done.includes(stepId) ? done.filter((x) => x !== stepId) : [...done, stepId],
            },
          };
        });
        scheduleBlob();
      },
      setRoutine: (steps) => {
        setState((s) => ({ ...s, routine: steps }));
        scheduleBlob();
      },
      setTherapistNote: (therapistId, patch) => {
        setState((s) => ({
          ...s,
          therapistNotes: {
            ...s.therapistNotes,
            [therapistId]: {
              contacted: false,
              note: "",
              ...s.therapistNotes[therapistId],
              ...patch,
            },
          },
        }));
        scheduleBlob();
      },
      logGrounding: (theme, breaths) => {
        setState((s) => ({
          ...s,
          groundingSessions: [
            ...s.groundingSessions,
            { at: new Date().toISOString(), theme, breaths },
          ].slice(-200),
          toolUse: { ...s.toolUse, grounding: (s.toolUse["grounding"] ?? 0) + 1 },
        }));
        logActivity("grounding", theme, { theme, breaths });
      },
      confirmBriefReceipt: (at) => {
        setState((s) => ({
          ...s,
          portalReceipts: { ...s.portalReceipts, [at]: new Date().toISOString() },
        }));
        scheduleBlob();
      },
      reset: () => {
        setState((s) => ({ ...initialState, band: s.band, ageGroup: s.ageGroup, name: s.name }));
        const appData: Record<string, unknown> = {};
        for (const k of blobKeys) appData[k] = initialState[k];
        send("/me", { appData }, "PATCH");
      },
    };
  }, [state, ready, user]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useApp must be used inside AppStateProvider");
  return ctx;
}

export const bandLabel: Record<AgeBand, string> = {
  child: "Child (4–12), with a grown-up's support",
  teen: "Teen (13–17)",
  adult: "Adult (18+)",
};

export function speak(text: string, enabled: boolean) {
  if (!enabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}
