/**
 * Caregiver Interaction Load — repetitive emotional interaction loops, boundary stress, sleep disruption.
 * Heuristic detection on unstructured caregiver text; NOT medical classification.
 */

export const INTERACTION_LOAD_SIGNAL_IDENTITY =
  "Interaction Load Signal detects repetitive cognitive-emotional loops that prevent caregivers from psychologically disengaging";

export const INTERACTION_LOAD_SIGNAL_ONE_LINE_TRUTH =
  "Caregiver Interaction Load Problem — interaction survivability over task lists when repetition, boundary stress, or sleep disruption appear.";

export const INTERACTION_LOAD_SIGNAL_PIPELINE_POSITION =
  "Input → Classification → Care Context → Load Interpretation → INTERACTION LOAD SIGNAL → CLI / Emotional Load → … → Decision → (interaction_survivability) containment output → Human Trust";

export const INTERACTION_LOAD_SIGNAL_FORBIDDEN = [
  "medical diagnosis or symptom labeling",
  "LLM classification for MVP detection",
  "replacing Caregiver Psychological Load containment",
  "mutating STATE or BELIEF from interaction load",
  "task lists or care schedules when sleep protection engaged",
] as const;

export const INTERACTION_LOAD_SYSTEM_INSIGHT =
  "Repetitive Emotional Interaction Loop Problem — caregiver stuck in unresolved communication cycles with no closure per interaction.";

/** Per-category score at or above counts as a pattern hit */
export const INTERACTION_PATTERN_HIT = 0.35;

/** Minimum distinct pattern categories to engage interaction load problem */
export const INTERACTION_LOAD_MIN_CATEGORIES = 2;

/** Boundary Violation Index at or above → boundary_stress flag */
export const BOUNDARY_VIOLATION_STRESS_THRESHOLD = 55;

/** Repetitive questioning score at or above → repetition_fatigue candidate */
export const REPETITION_FATIGUE_THRESHOLD = 0.4;

export const INTERACTION_LOAD_FLAG_DESCRIPTIONS = {
  repetition_fatigue: "high recurrence interaction detected",
  boundary_stress: "user unable to redirect or disengage",
} as const;

export const INTERACTION_LOAD_METRIC_BOOST = {
  emotionalLoadPerPattern: 12,
  cognitiveLoadPerPattern: 10,
  conflictLoadPerBoundary: 18,
  coordinationLoadPerRepetition: 14,
  depletionPerSleepCritical: 0.4,
  depletionPerAlwaysOn: 0.25,
  emotionalBiasPerExhaustion: 0.15,
} as const;

export const SLEEP_PROTECTION_MAX_ACTIONS = 2;
export const SLEEP_PROTECTION_MAX_LOW_COGNITIVE_SUGGESTIONS = 2;

export const INTERACTION_SURVIVABILITY_NORMALIZATION =
  "Repeated interactions without closure are part of what is held. When ready, share what is happening in care.";

export const INTERACTION_SURVIVABILITY_CONTAINMENT =
  "Right now the priority is protecting rest and closing loops you can — not adding more care tasks.";

export const INTERACTION_SURVIVABILITY_MINIMAL_SUGGESTION =
  "When you can, use one short pause to close the loop — then rest. No new care tasks tonight.";

export const INTERACTION_LOAD_PATTERNS = {
  repetitiveQuestioning: [
    /\b(same questions? (?:over and over|again and again|repeatedly)|asks? the same (?:thing|questions?) (?:over|again)|keeps? asking|asked again|over and over)\b/i,
    /\b(repeat(?:ing|s)? (?:the )?(?:same )?questions?|question(?:ing)? loop|going in circles)\b/i,
  ],
  redirectFailure: [
    /\b(can't redirect|cannot redirect|unable to redirect|won't (?:stop|let (?:me|go))|can't (?:end|stop|disengage)|cannot (?:end|stop|disengage))\b/i,
    /\b(won't change (?:the )?subject|keeps? coming back|persistent re[- ]?engagement|can't get (?:off|out of) (?:the )?(?:call|conversation))\b/i,
    /\b(trapped in (?:the )?conversation|emotional entrapment|no closure)\b/i,
  ],
  nighttimeInterruption: [
    /\b(calls? at night|calling at night|waking me (?:up )?at night|texts? at night|messages? at night|middle of the night)\b/i,
    /\b(nighttime (?:calls?|interruptions?)|after midnight|late[- ]night (?:calls?|messages?))\b/i,
  ],
  emotionalExhaustion: [
    /\b(emotionally exhausted|emotionally drained|so exhausted|completely drained|no energy left|running on empty)\b/i,
    /\b(frustrated and (?:tired|exhausted)|helpless(?:ness)?|can't cope emotionally|cannot cope emotionally)\b/i,
  ],
  alwaysOnCall: [
    /\b(always on call|on call (?:all the time|24\/7)|never (?:off duty|a break)|feel(?:ing)? constantly (?:on|available)|always (?:on|available))\b/i,
    /\b(24\/7|round the clock|always reachable|no rest boundaries|loss of rest boundaries)\b/i,
  ],
} as const;

export const INTERACTION_PATTERN_LABELS = {
  repetitiveQuestioning: "repeated questioning cycles",
  redirectFailure: "inability to redirect conversations",
  nighttimeInterruption: "nighttime interruptions",
  emotionalExhaustion: "emotional exhaustion",
  alwaysOnCall: "always-on expectation",
} as const;
