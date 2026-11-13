import { useQuery } from "@tanstack/react-query";
import raw from "@/data/therapists.json";
import { api } from "@/lib/api";
import type { AgeBand } from "@/lib/app-state";

export type Therapist = {
  id: string;
  name: string;
  credentials: string;
  jobTitle: string;
  practiceName: string;
  city: string;
  state: string;
  stateName: string;
  phone: string;
  profileUrl: string;
  photoUrl: string;
  bio: string;
  issues: string[];
  ageGroups: string[];
  insurance: string[];
  modalities: string[];
  languages: string[];
  acceptingNewClients: boolean;
  online: boolean;
  inPerson: boolean;
  slidingScale: boolean;
  sessionCost: number | null;
  yearsInPractice: number | null;
  /** Partner tier only: therapists who signed up directly to receive briefs. */
  partner?: boolean;
  email?: string;
};

export const directory = raw as Therapist[];

/**
 * Partner network — the only tier where a brief can be sent automatically.
 * These are therapists who opted in directly, so a real email and a real
 * consent to the relationship exist. It starts small on purpose.
 */
/**
 * The partner network now lives in the database: clinicians apply through the
 * therapist portal and an administrator verifies their licence before they
 * appear here. (The earlier hard-coded sample partners were fictional and have
 * been removed so nobody believes they sent a brief to a real person.)
 */
export const partners: Therapist[] = [];

type ApiPartner = {
  id: string;
  name: string;
  credentials: string;
  practice: string;
  bio: string;
  city: string;
  country: string;
  issues: string[];
  ageGroups: string[];
  languages: string[];
  online: boolean;
  inPerson: boolean;
  licenseRegion: string;
};

export function toTherapist(p: ApiPartner): Therapist {
  return {
    id: p.id,
    name: p.name,
    credentials: p.credentials,
    jobTitle: p.credentials,
    practiceName: p.practice,
    city: p.city,
    state: p.licenseRegion,
    stateName: p.country || p.licenseRegion,
    phone: "",
    profileUrl: "",
    photoUrl: "",
    bio: p.bio,
    issues: p.issues,
    ageGroups: p.ageGroups,
    insurance: [],
    modalities: [p.online ? "Online" : "", p.inPerson ? "In person" : ""].filter(Boolean),
    languages: p.languages,
    acceptingNewClients: true,
    online: p.online,
    inPerson: p.inPerson,
    slidingScale: false,
    sessionCost: null,
    yearsInPractice: null,
    partner: true,
  };
}

/** Verified partner therapists who see this member's age group (from the server). */
export function usePartners() {
  return useQuery({
    queryKey: ["partners"],
    queryFn: async () =>
      (await api<{ partners: ApiPartner[] }>("/therapists/partners")).partners.map(toTherapist),
  });
}

/** The dataset's own age groups, mapped onto the app's three bands. */
const bandAgeGroups: Record<AgeBand, string[]> = {
  child: ["Toddlers Preschoolers 0 to 6", "Children (6 to 10)"],
  teen: ["Preteen", "Teen"],
  adult: ["Adults", "Elders (65+)"],
};

export function servesBand(t: Therapist, band: AgeBand) {
  const wanted = bandAgeGroups[band];
  return t.ageGroups.some((g) => wanted.includes(g));
}

export const allIssues = [...new Set(directory.flatMap((t) => t.issues))]
  .filter((i) => i !== "Other")
  .sort();

export const allInsurance = [...new Set(directory.flatMap((t) => t.insurance))].sort();

/**
 * "Patterns Worth Exploring" areas → directory issue tags. Deliberately loose:
 * a pattern is a starting point for a conversation, not a diagnosis.
 */
export const patternIssueMap: { match: RegExp; issues: string[]; label: string }[] = [
  {
    match: /autis|sensory|masking/i,
    issues: ["Autism", "ADHD", "Coping Skills"],
    label: "autism-related traits",
  },
  { match: /sleep/i, issues: ["Sleep or Insomnia", "Stress", "Anxiety"], label: "sleep" },
  {
    match: /mood|anxi|low mood|overwhelm|meltdown|heavier/i,
    issues: ["Anxiety", "Depression", "Stress"],
    label: "mood and anxiety",
  },
  {
    match: /function|executive|everyday/i,
    issues: ["ADHD", "Coping Skills", "Life Transitions"],
    label: "everyday functioning",
  },
  {
    match: /self-harm|risk/i,
    issues: ["Suicidal Ideation", "Self-Harm", "Trauma and PTSD"],
    label: "safety",
  },
];

export function issuesForPatterns(labels: string[]) {
  const out = new Set<string>();
  for (const label of labels)
    for (const entry of patternIssueMap)
      if (entry.match.test(label)) entry.issues.forEach((i) => out.add(i));
  return [...out];
}

export function matchesIssues(t: Therapist, issues: string[]) {
  if (issues.length === 0) return true;
  return issues.some((i) => t.issues.includes(i));
}
