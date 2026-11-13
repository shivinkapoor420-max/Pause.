import raw from "@/data/therapists.json";
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
export const partners: Therapist[] = [
  {
    id: "partner-okonkwo",
    name: "Dr. Ada Okonkwo",
    credentials: "PhD, Licensed Psychologist",
    jobTitle: "Psychologist",
    practiceName: "Northside Neurodiversity Practice",
    city: "Chicago",
    state: "IL",
    stateName: "Illinois",
    phone: "(312) 555-0142",
    profileUrl: "",
    photoUrl: "",
    bio: "Adult autism and ADHD identification, plus anxiety and burnout. Works slowly, writes plainly, and treats neurodivergence as a difference rather than a deficit.",
    issues: ["Anxiety", "ADHD", "Autism", "Depression", "Stress", "Self Esteem"],
    ageGroups: ["Teen", "Adults", "Elders (65+)"],
    insurance: ["Aetna", "BlueCross and BlueShield", "Cigna", "Out of Network"],
    modalities: ["Individuals", "Online"],
    languages: ["English"],
    acceptingNewClients: true,
    online: true,
    inPerson: true,
    slidingScale: true,
    sessionCost: 190,
    yearsInPractice: 14,
    partner: true,
    email: "intake@northside-neuro.example",
  },
  {
    id: "partner-vasquez",
    name: "Marisol Vásquez",
    credentials: "LCSW",
    jobTitle: "Clinical Social Work/Therapist",
    practiceName: "Small Weather Counseling",
    city: "Austin",
    state: "TX",
    stateName: "Texas",
    phone: "(512) 555-0198",
    profileUrl: "",
    photoUrl: "",
    bio: "Play-based work with young children and their caregivers. Sensory needs, meltdowns, school transitions and family conflict, always with the caregiver in the room.",
    issues: [
      "Behavioral Issues",
      "School Issues",
      "Family Conflict",
      "Autism",
      "Anxiety",
      "Emotional Disturbance",
    ],
    ageGroups: ["Toddlers Preschoolers 0 to 6", "Children (6 to 10)", "Preteen"],
    insurance: ["Medicaid", "Aetna", "UnitedHealthcare UHC | UBH", "Sliding scale"],
    modalities: ["Individuals", "Family"],
    languages: ["English", "Spanish"],
    acceptingNewClients: true,
    online: true,
    inPerson: true,
    slidingScale: true,
    sessionCost: 120,
    yearsInPractice: 9,
    partner: true,
    email: "hello@smallweather.example",
  },
  {
    id: "partner-brand",
    name: "Toby Brand",
    credentials: "LPC, NCC",
    jobTitle: "Licensed Professional Counselor",
    practiceName: "Quiet Room Therapy",
    city: "Portland",
    state: "OR",
    stateName: "Oregon",
    phone: "(503) 555-0117",
    profileUrl: "",
    photoUrl: "",
    bio: "Teens and young adults. Low-pressure sessions, no forced eye contact, and a lot of patience with the weeks where nothing much gets said.",
    issues: [
      "Anxiety",
      "Depression",
      "Peer Relationships",
      "Self Esteem",
      "Trauma and PTSD",
      "Suicidal Ideation",
      "ADHD",
    ],
    ageGroups: ["Preteen", "Teen", "Adults"],
    insurance: ["Kaiser", "Providence", "Out of Network"],
    modalities: ["Individuals", "Online"],
    languages: ["English"],
    acceptingNewClients: true,
    online: true,
    inPerson: false,
    slidingScale: false,
    sessionCost: 140,
    yearsInPractice: 7,
    partner: true,
    email: "intake@quietroom.example",
  },
];

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
  { match: /autis|sensory|masking/i, issues: ["Autism", "ADHD", "Coping Skills"], label: "autism-related traits" },
  { match: /sleep/i, issues: ["Sleep or Insomnia", "Stress", "Anxiety"], label: "sleep" },
  { match: /mood|anxi|low mood|overwhelm|meltdown|heavier/i, issues: ["Anxiety", "Depression", "Stress"], label: "mood and anxiety" },
  { match: /function|executive|everyday/i, issues: ["ADHD", "Coping Skills", "Life Transitions"], label: "everyday functioning" },
  { match: /self-harm|risk/i, issues: ["Suicidal Ideation", "Self-Harm", "Trauma and PTSD"], label: "safety" },
];

export function issuesForPatterns(labels: string[]) {
  const out = new Set<string>();
  for (const label of labels)
    for (const entry of patternIssueMap) if (entry.match.test(label)) entry.issues.forEach((i) => out.add(i));
  return [...out];
}

export function matchesIssues(t: Therapist, issues: string[]) {
  if (issues.length === 0) return true;
  return issues.some((i) => t.issues.includes(i));
}
