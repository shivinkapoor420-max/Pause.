import type { AgeBand } from "@/lib/app-state";

export type Question = {
  id: string;
  text: string;
  thread: "mood" | "autism" | "sleep" | "function" | "risk";
  scale: string[];
  risk?: boolean;
};

const freq = ["Not lately", "Some days", "Most days", "Every day"];

export const checkinQuestions: Record<AgeBand, Question[]> = {
  child: [
    {
      id: "c-eye",
      thread: "autism",
      text: "Does your child look at you to share something exciting (pointing, then checking your face)?",
      scale: ["Usually", "Sometimes", "Rarely", "Almost never"],
    },
    {
      id: "c-play",
      thread: "autism",
      text: "How does your child play — lining up and sorting, deep-diving one favourite thing, or pretend play with others?",
      scale: [
        "Mostly pretend with others",
        "A mix",
        "Mostly alone, one favourite",
        "Almost always lining up or sorting",
      ],
    },
    {
      id: "c-speech",
      thread: "autism",
      text: "How is speech and language compared to what you'd expect for their age?",
      scale: ["On track", "A little behind", "Noticeably behind", "Lost words they used to have"],
    },
    {
      id: "c-sensory",
      thread: "autism",
      text: "Strong reactions to sound, light, textures or clothing tags?",
      scale: freq,
    },
    {
      id: "c-sleep",
      thread: "sleep",
      text: "Trouble falling asleep or staying asleep this week?",
      scale: freq,
    },
    {
      id: "c-melt",
      thread: "mood",
      text: "Meltdowns or shutdowns this week?",
      scale: ["None", "One or two", "Several", "Most days"],
    },
    {
      id: "c-reg",
      thread: "mood",
      text: "How long does it take them to settle after getting upset?",
      scale: [
        "A few minutes",
        "10–20 minutes",
        "Half an hour or more",
        "Most of the day feels hard",
      ],
    },
    {
      id: "c-hurt",
      thread: "risk",
      risk: true,
      text: "Has your child hurt themselves on purpose (head-banging, biting, hitting themselves) when overwhelmed?",
      scale: ["No", "Once", "A few times", "Often"],
    },
  ],
  teen: [
    {
      id: "t-mood",
      thread: "mood",
      text: "How often has everything felt flat, heavy or pointless?",
      scale: freq,
    },
    { id: "t-anx", thread: "mood", text: "Worry that's hard to switch off?", scale: freq },
    {
      id: "t-sleep",
      thread: "sleep",
      text: "How's sleep been?",
      scale: ["Fine", "A bit off", "Rough most nights", "Barely sleeping"],
    },
    {
      id: "t-social",
      thread: "autism",
      text: "Do social situations take real effort to figure out — reading tone, knowing when to speak?",
      scale: ["Rarely", "Sometimes", "Often", "Almost always"],
    },
    {
      id: "t-mask",
      thread: "autism",
      text: "Do you copy how others act to fit in, then feel wiped out afterwards?",
      scale: ["Rarely", "Sometimes", "Often", "Almost always"],
    },
    {
      id: "t-sensory",
      thread: "autism",
      text: "Do noise, lights, smells or crowds get overwhelming — like at school?",
      scale: freq,
    },
    {
      id: "t-school",
      thread: "function",
      text: "Has school been harder than usual — turning up, keeping up, focusing?",
      scale: ["No change", "A little harder", "A lot harder", "I'm barely managing"],
    },
    {
      id: "t-routine",
      thread: "autism",
      text: "Have your interests or routines shifted a lot lately?",
      scale: ["No", "A little", "Quite a bit", "Completely"],
    },
    {
      id: "t-risk",
      thread: "risk",
      risk: true,
      text: "In the last two weeks, have you had thoughts of hurting yourself or that you'd be better off gone?",
      scale: ["No", "A passing thought", "More than once", "I'm thinking about it now"],
    },
  ],
  adult: [
    {
      id: "a-mood",
      thread: "mood",
      text: "Over the past month, how often has your mood been low or numb?",
      scale: freq,
    },
    { id: "a-anx", thread: "mood", text: "Persistent anxiety, tension or dread?", scale: freq },
    {
      id: "a-sleep",
      thread: "sleep",
      text: "Sleep quality across the month?",
      scale: ["Steady", "Uneven", "Poor most nights", "Severely disrupted"],
    },
    {
      id: "a-exec",
      thread: "function",
      text: "Planning, starting tasks, switching between them — how much friction?",
      scale: ["Little", "Some", "A lot", "Everything stalls"],
    },
    {
      id: "a-time",
      thread: "function",
      text: "Time blindness — losing track of hours, chronically late or hyperfocused?",
      scale: freq,
    },
    {
      id: "a-work",
      thread: "function",
      text: "Has work or study been affected?",
      scale: ["No", "A little", "Noticeably", "Significantly"],
    },
    {
      id: "a-rel",
      thread: "function",
      text: "Have close relationships felt strained or hard to maintain?",
      scale: freq,
    },
    {
      id: "a-sensory",
      thread: "autism",
      text: "Sensitivity to sound, light, texture or busy environments?",
      scale: ["Rarely", "Sometimes", "Often", "Constantly"],
    },
    {
      id: "a-mask",
      thread: "autism",
      text: "Do you script and perform social interactions, then need to recover afterwards?",
      scale: ["Rarely", "Sometimes", "Often", "Almost always"],
    },
    {
      id: "a-burn",
      thread: "mood",
      text: "Burnout — depleted in a way rest doesn't fix?",
      scale: ["No", "Somewhat", "Considerably", "Completely"],
    },
    {
      id: "a-risk",
      thread: "risk",
      risk: true,
      text: "In the past two weeks, have you had thoughts of harming yourself or not wanting to be here?",
      scale: ["No", "A passing thought", "More than once", "I'm having them now"],
    },
  ],
};

export const moodTags: Record<AgeBand, string[]> = {
  child: ["Happy", "Tired", "Wiggly", "Sad", "Too loud", "Sore", "Silly"],
  teen: ["Low mood", "Anxious", "Tired", "Overstimulated", "Masking", "Lonely", "Focused", "Okay"],
  adult: [
    "Low mood",
    "Anxious",
    "Sleep disruption",
    "Sensory overwhelm",
    "Masking fatigue",
    "Executive friction",
    "Steady",
    "Connected",
  ],
};

export const journalPrompts: Record<AgeBand, string[]> = {
  child: [
    "What made you smile today?",
    "Who did you play with?",
    "What felt too loud or too itchy today?",
  ],
  teen: [
    "What took the most energy today?",
    "Was there a moment you felt like yourself?",
    "Where did you mask today, and what did it cost?",
    "What would you tell a friend who had your day?",
  ],
  adult: [
    "What pattern did you notice in yourself this week?",
    "Where did your energy actually go today?",
    "What did you push through that you didn't have to?",
    "What does recovery look like for you right now?",
  ],
};

export const resources: Record<AgeBand, { title: string; body: string; tag: string }[]> = {
  child: [
    {
      tag: "For caregivers",
      title: "Meltdown vs. tantrum",
      body: "A tantrum has a goal and stops when the goal changes. A meltdown is a nervous system past capacity — it needs less input, not more consequences. Lower the lights, cut the talking, wait it out nearby.",
    },
    {
      tag: "For caregivers",
      title: "Sensory profiles, plainly",
      body: "Some kids seek input (crashing, spinning, chewing); some avoid it (tags, seams, hand dryers). Most do both, in different channels. Noticing which is which makes days easier to design.",
    },
    {
      tag: "For kids",
      title: "Big feelings are weather",
      body: "Feelings move through, like rain. Rain isn't bad. It just needs somewhere dry to wait.",
    },
    {
      tag: "Next steps",
      title: "Who to ask",
      body: "A developmental pediatrician, a child psychologist, or an autism assessment specialist can look properly at what you've been noticing. Bring your exported summary.",
    },
  ],
  teen: [
    {
      tag: "Autism",
      title: "What masking actually is",
      body: "Masking is running social software manually — copying expressions, rehearsing lines, suppressing stims. It works, and it's expensive. Feeling wrecked after a normal day is data, not weakness.",
    },
    {
      tag: "Mental health",
      title: "Low mood vs. a bad week",
      body: "Bad weeks lift. When flatness holds for most days over two weeks and touches sleep, appetite and interest, that's worth telling an adult you trust or a counselor.",
    },
    {
      tag: "Skills",
      title: "Grounding when it spikes",
      body: "Name five things you can see, four you can hear, three you can touch. It's not a trick — it pulls attention out of the spiral and back into the room.",
    },
    {
      tag: "Next steps",
      title: "Telling someone",
      body: "You can say: 'I've been tracking how I feel and I'd like to talk to someone.' You don't need the right words or a diagnosis to ask for help.",
    },
  ],
  adult: [
    {
      tag: "Autism",
      title: "Late identification",
      body: "Many adults — often women and nonbinary people — reach autism identification after decades of compensating. Recognition usually explains a history rather than announcing a change.",
    },
    {
      tag: "Autism",
      title: "Autistic burnout",
      body: "Distinct from depression: it follows sustained masking and demand overload, comes with skill loss and reduced sensory tolerance, and responds to demand reduction more than to activation.",
    },
    {
      tag: "Executive function",
      title: "Task breakdown that works",
      body: "Shrink the first step until it's boring. 'Write the report' becomes 'open the document and type the title.' Momentum is easier to steer than to summon.",
    },
    {
      tag: "Next steps",
      title: "Finding the right clinician",
      body: "For mood and anxiety: a therapist or psychiatrist. For autism identification: a clinician who assesses adults specifically, and who won't screen you out for making eye contact.",
    },
  ],
};
