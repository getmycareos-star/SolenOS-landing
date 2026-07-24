/** Clarification Engine — minimum questions to reduce uncertainty before reasoning. */

export const CLARIFICATION_ENGINE_IDENTITY =
  "solenos does not ask questions to collect data. It asks questions to reduce uncertainty with the smallest possible burden on the caregiver.";

export const CLARIFICATION_DEFINING_PRINCIPLE =
  "A weak system fills gaps with assumptions. A strong system identifies gaps and resolves them.";

export const CLARIFICATION_CATEGORIES = [
  "time",
  "change",
  "severity",
  "behavior",
  "medication",
  "environment",
] as const;

export const UNCERTAINTY_LEVELS = ["low", "medium", "high", "critical"] as const;

/** Question budget by uncertainty level. */
export const CLARIFICATION_BUDGET: Record<(typeof UNCERTAINTY_LEVELS)[number], number> = {
  low: 0,
  medium: 3,
  high: 5,
  critical: 5,
};

export const MISSING_DIMENSIONS = [
  "timeline",
  "symptoms",
  "severity",
  "triggers",
  "progression",
  "frequency",
  "safety_impact",
  "medication_context",
  "environment_context",
] as const;

export const CLARIFICATION_TEMPLATES: Record<
  (typeof CLARIFICATION_CATEGORIES)[number],
  { question: string; dimension: string; rationale: string }[]
> = {
  time: [
    {
      question: "When did this start?",
      dimension: "timeline",
      rationale: "When a change started can significantly affect how the situation is interpreted.",
    },
    {
      question: "Has it been getting better or worse?",
      dimension: "progression",
      rationale: "Direction of change helps prioritize what matters now.",
    },
    {
      question: "Is it happening right now?",
      dimension: "timeline",
      rationale: "Current vs past affects urgency without assuming medical severity.",
    },
  ],
  change: [
    {
      question: "What was different before?",
      dimension: "symptoms",
      rationale: "Baseline comparison reduces guesswork about what changed.",
    },
    {
      question: "Has anything similar happened before?",
      dimension: "frequency",
      rationale: "Recurrence patterns strengthen continuity without new assumptions.",
    },
  ],
  severity: [
    {
      question: "How concerning is this compared to normal?",
      dimension: "severity",
      rationale: "Caregiver-reported severity helps prioritize without clinical labeling.",
    },
    {
      question: "Has it affected safety or daily activities?",
      dimension: "safety_impact",
      rationale: "Safety impact is observable — not a diagnosis.",
    },
  ],
  behavior: [
    {
      question: "What exactly are they doing differently?",
      dimension: "symptoms",
      rationale: "Specific behavior is more actionable than vague 'not himself'.",
    },
    {
      question: "How often does it happen?",
      dimension: "frequency",
      rationale: "Frequency helps distinguish isolated incidents from patterns.",
    },
  ],
  medication: [
    {
      question: "Any recent medication changes?",
      dimension: "medication_context",
      rationale: "Medication changes are a common reversible context for behavior shifts.",
    },
    {
      question: "Any missed doses or new side effects noticed?",
      dimension: "medication_context",
      rationale: "Observable medication facts — not clinical conclusions.",
    },
  ],
  environment: [
    {
      question: "Any changes in routine or caregivers recently?",
      dimension: "environment_context",
      rationale: "Environmental shifts often explain behavior without inventing causes.",
    },
    {
      question: "Any recent travel, hospitalization, or discharge?",
      dimension: "environment_context",
      rationale: "Recent care transitions are high-signal continuity context.",
    },
  ],
};

export const VAGUE_INPUT_PATTERNS = [
  /\bisn'?t acting like (?:him|her|themselves|himself)\b/i,
  /\bnot (?:him|her|themselves|himself)\b/i,
  /\bsomething (?:is\s+)?(?:wrong|off|different)\b/i,
  /\bseems (?:confused|off|different|worse|not right)\b/i,
  /\bnot sure what'?s going on\b/i,
];
