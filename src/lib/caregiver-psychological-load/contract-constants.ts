/**
 * Caregiver Psychological Load — moral injury, identity drift, emotional validation.
 * DERIVED from BELIEF + STATE + emotional signals — not a competing engine.
 */

export const CAREGIVER_PSYCHOLOGICAL_LOAD_IDENTITY =
  "Caregiver Psychological Load captures moral injury, identity drift, and retention-critical emotional validation — load reducers, not task expansion";

export const CAREGIVER_PSYCHOLOGICAL_LOAD_ONE_LINE_TRUTH =
  "Moral injury + identity drift are pure derived functions over CLI, emotional load, input signals, and conflict loops; emotional validation is EXPLANATION adjunct only.";

export const CAREGIVER_PSYCHOLOGICAL_LOAD_PIPELINE_POSITION =
  "… → CLI → Emotional Load → Moral Injury + Identity Drift → Conflict (emotional loops) → Decision → Fail-Safe → Human Trust (+ Emotional Validation) → Safety → Output";

export const CAREGIVER_PSYCHOLOGICAL_LOAD_FORBIDDEN = [
  "task manager / assistant expansion under high load",
  "persistent psychological diagnosis engine",
  "mutating STATE or BELIEF from validation output",
  "replacing Caregiver Load Index or Emotional Load Signal",
] as const;

/** CLI normalized score band (0–1) for containment — maps to score 80–95. */
export const CLI_CONTAINMENT_ZONE = {
  min: 0.8,
  max: 0.95,
} as const;

export const CONTAINMENT_MAX_ACTIONS = 1;

export const EMOTIONAL_VALIDATION_DEFAULT_MESSAGE =
  "What you shared is held in the Living Care Record. When you are ready, add any care detail that would help the picture.";

export const MORAL_INJURY_SEVERITY_ORDER = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
] as const;

export const IDENTITY_DRIFT_LEVEL_ORDER = [
  "STABLE",
  "EMERGING",
  "SIGNIFICANT",
  "FRAGMENTED",
] as const;

/** Open conflicts at or above this count + emotional loop → chronic unresolved. */
export const CHRONIC_CONFLICT_OPEN_THRESHOLD = 2;

/** Grounding copy when Acute Caregiver Burnout Risk State is active — EXPLANATION only; never therapy voice. */
export const ACUTE_BURNOUT_GROUNDING_MESSAGE =
  "What you shared is held. One steady care detail is enough for now — no care plan required in this moment.";

export const HIGH_SIGNAL_STRESS_IDENTITY =
  "High-Signal Stress Pattern — emotional threat + sleep deprivation + uncertainty overload; triggers Containment Mode, not task expansion";

export const HIGH_SIGNAL_STRESS_ONE_LINE_TRUTH =
  "Acute Caregiver Burnout Risk State when verbal/emotional harm + sleep disruption + uncertainty overload are all present — prioritize interaction survivability over task management.";

/** Verbal abuse / emotional harm / stress exhaustion — environmental, not medical. */
export const EMOTIONAL_HARM_SIGNALS: readonly { pattern: RegExp; indicator: string }[] = [
  { pattern: /\bverbal abuse\b/i, indicator: "verbal abuse" },
  { pattern: /\byell(?:s|ed|ing)?\s+at\s+me\b/i, indicator: "yelled at" },
  { pattern: /\bscream(?:s|ed|ing)?\s+at\s+me\b/i, indicator: "screamed at" },
  { pattern: /\bhostile\b/i, indicator: "hostile environment" },
  { pattern: /\bemotional(?:ly)?\s+(?:abuse|harm|attack)\b/i, indicator: "emotional harm" },
  { pattern: /\bput(?:s|ting)?\s+me\s+down\b/i, indicator: "put me down" },
  { pattern: /\bcruel\s+(?:words|things)\b/i, indicator: "cruel words" },
  { pattern: /\bthreaten(?:s|ed|ing)?\b/i, indicator: "threatening language" },
  { pattern: /\b(?:feel|feeling)\s+unsafe\b/i, indicator: "lack of emotional safety" },
  { pattern: /\bno\s+emotional\s+safety\b/i, indicator: "lack of emotional safety" },
  { pattern: /\boverwhelm(?:ed|ing)?\b/i, indicator: "overwhelm" },
  { pattern: /\bexhausted\b/i, indicator: "exhaustion" },
  { pattern: /\bcan'?t\s+(?:take|handle)\s+(?:it|this)\s+anymore\b/i, indicator: "emotional overload" },
  { pattern: /\b(?:so|completely)\s+stressed\b/i, indicator: "stress" },
  { pattern: /\bemotionally\s+(?:drained|depleted|destroyed)\b/i, indicator: "emotional depletion" },
];

/** Sleepless nights / night interruption / no recovery / always-on caregiving. */
export const SLEEP_DISRUPTION_SIGNALS: readonly { pattern: RegExp; indicator: string }[] = [
  { pattern: /\bsleepless\s+nights?\b/i, indicator: "sleepless nights" },
  { pattern: /\b(?:haven'?t|have not)\s+slept\b/i, indicator: "haven't slept" },
  { pattern: /\bno\s+sleep\b/i, indicator: "no sleep" },
  { pattern: /\bup\s+all\s+night\b/i, indicator: "up all night" },
  { pattern: /\bwake(?:s|d)?\s+(?:up\s+)?(?:every|each)\s+night\b/i, indicator: "nightly interruption" },
  { pattern: /\binterrupted\s+(?:every|each)\s+night\b/i, indicator: "nightly interruption" },
  { pattern: /\bno\s+(?:recovery|rest)\b/i, indicator: "no recovery/rest" },
  { pattern: /\b(?:never|not)\s+(?:get(?:ting)?\s+)?rest\b/i, indicator: "no recovery/rest" },
  { pattern: /\balways[\s-]?on\s+caregiv/i, indicator: "always-on caregiving" },
  { pattern: /\b24\s*\/\s*7\s+care\b/i, indicator: "always-on caregiving" },
  { pattern: /\b(?:only|just)\s+(?:1|2|3)\s+hours?\s+of\s+sleep\b/i, indicator: "severe sleep deprivation" },
  { pattern: /\bhaven'?t\s+slept\s+(?:in\s+)?(?:days|a\s+day)\b/i, indicator: "prolonged sleep loss" },
];

/** Uncertainty overload — unpredictability, inability to anticipate. */
export const UNCERTAINTY_OVERLOAD_SIGNALS: readonly { pattern: RegExp; indicator: string }[] = [
  { pattern: /\bdon'?t\s+know\s+what'?s\s+next\b/i, indicator: "not knowing what's next" },
  { pattern: /\bnot\s+knowing\s+what\s+(?:comes|happens)\s+next\b/i, indicator: "not knowing what's next" },
  { pattern: /\bno\s+idea\s+what\s+(?:will|might)\s+happen\b/i, indicator: "unpredictability" },
  { pattern: /\bunpredictable\b/i, indicator: "unpredictability" },
  { pattern: /\bcan'?t\s+anticipate\b/i, indicator: "inability to anticipate" },
  { pattern: /\bunable\s+to\s+anticipate\b/i, indicator: "inability to anticipate" },
  { pattern: /\b(?:everything|anything)\s+(?:could|might)\s+change\b/i, indicator: "uncertainty overload" },
  { pattern: /\bno\s+one\s+(?:can\s+)?tell\s+me\s+what\s+(?:to\s+expect|happens)\b/i, indicator: "uncertainty overload" },
  { pattern: /\b(?:living|operating)\s+in\s+(?:the\s+)?dark\b/i, indicator: "uncertainty overload" },
];
