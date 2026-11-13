import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

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
  sentBriefs: { at: string; therapistId: string; therapistName: string; kind?: "brief" | "update" }[];
  /** Therapist-side portal account, if this device signed up as a therapist. */
  portal: PortalTherapist | null;
  /** Briefs the portal has confirmed receipt of: sentBrief `at` → confirmed ISO date. */
  portalReceipts: Record<string, string>;
  /** Grounding Room sessions, feeding the Growth Garden. */
  groundingSessions: { at: string; theme: string; breaths: number }[];
};

const STORAGE_KEY = "pause.state.v1";

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

};

const AppStateContext = createContext<Ctx | null>(null);

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as AppState;
        setState({
          ...initialState,
          ...saved,
          settings: { ...initialState.settings, ...saved.settings },
        });
      }
    } catch {
      /* start fresh */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, ready]);

  useEffect(() => {
    if (!ready) return;
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
  }, [ready, state.settings]);

  const value = useMemo<Ctx>(() => {
    const update = (patch: Partial<AppState>) => setState((s) => ({ ...s, ...patch }));
    const patchSession = (id: string, fn: (s: CompanionSession) => CompanionSession) =>
      setState((s) => ({
        ...s,
        companion: s.companion.map((c) => (c.id === id ? fn(c) : c)),
      }));

    return {
      state,
      ready,
      update,
      setMood: (sky, tags) =>
        setState((s) => ({
          ...s,
          moods: [...s.moods.filter((m) => m.date !== today()), { date: today(), sky, tags }],
        })),
      addJournal: (entry) =>
        setState((s) => ({
          ...s,
          journal: [
            { ...entry, id: crypto.randomUUID(), date: new Date().toISOString() },
            ...s.journal,
          ],
        })),
      addCheckin: (record) =>
        setState((s) => ({
          ...s,
          riskFlagged: s.riskFlagged || record.flagged,
          checkins: [
            { ...record, id: crypto.randomUUID(), date: new Date().toISOString() },
            ...s.checkins,
          ],
        })),
      useTool: (id) =>
        setState((s) => ({ ...s, toolUse: { ...s.toolUse, [id]: (s.toolUse[id] ?? 0) + 1 } })),
      setSettings: (patch) => setState((s) => ({ ...s, settings: { ...s.settings, ...patch } })),
      startCompanionSession: (mode) => {
        const id = crypto.randomUUID();
        setState((s) => ({
          ...s,
          companion: [
            {
              id,
              date: new Date().toISOString(),
              band: s.band ?? "adult",
              mode,
              turns: [],
              observations: [],
            },
            ...s.companion,
          ],
        }));
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
      clearVoiceData: () => setState((s) => ({ ...s, companion: [] })),
      toggleRoutineStep: (stepId) =>
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
        }),
      setRoutine: (steps) => setState((s) => ({ ...s, routine: steps })),
      setTherapistNote: (therapistId, patch) =>
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
        })),
      logGrounding: (theme, breaths) =>
        setState((s) => ({
          ...s,
          groundingSessions: [
            ...s.groundingSessions,
            { at: new Date().toISOString(), theme, breaths },
          ].slice(-200),
          toolUse: { ...s.toolUse, grounding: (s.toolUse["grounding"] ?? 0) + 1 },
        })),
      confirmBriefReceipt: (at) =>
        setState((s) => ({
          ...s,
          portalReceipts: { ...s.portalReceipts, [at]: new Date().toISOString() },
        })),
      reset: () => setState({ ...initialState, startedOn: null }),

    };
  }, [state, ready]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useApp must be used inside AppStateProvider");
  return ctx;
}

export const bandLabel: Record<AgeBand, string> = {
  child: "Young child (4–10), caregiver-led",
  teen: "Tween or teen (11–17)",
  adult: "Adult (18+)",
};

export function speak(text: string, enabled: boolean) {
  if (!enabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}
