/**
 * Emotional Load Signal — CRITICAL SYSTEM LAYER (v1.0)
 * DERIVED from STATE + BELIEF + Caregiver Load Index — not a competing emotion engine.
 * A correct recommendation that exceeds human emotional capacity is still WRONG.
 */

export const EMOTIONAL_LOAD_SIGNAL_IDENTITY =
  "Emotional Load Signal measures invisible caregiver stress, burnout probability, and cognitive fatigue from behavioral signals — not self-report or mental health diagnosis";

export const EMOTIONAL_LOAD_SIGNAL_ONE_LINE_TRUTH =
  "ELS is a derived function over STATE (situations/demands) + BELIEF (uncertainty/conflicts) + CLI signals; it adjusts priority and output before fail-safe, never persists as an engine.";

export const EMOTIONAL_LOAD_SIGNAL_PIPELINE_POSITION =
  "… → Decision Engine → EMOTIONAL LOAD SIGNAL ENGINE → Fail-Safe Mode → Human Trust → Safety → Output";

export const EMOTIONAL_LOAD_SIGNAL_EARLY_POSITION =
  "Demand → Caregiver Load Index → Emotional Load Signal (load-aware) → Priority → Decision";

export const EMOTIONAL_LOAD_SIGNAL_FORBIDDEN = [
  "mental health diagnosis or therapy routing",
  "competing persistent emotion engine",
  "self-report as primary signal",
  "replacing Caregiver Load Index operational measure",
  "UI-only decoration without pipeline effects",
] as const;

export const COGNITIVE_FATIGUE_LEVELS = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
] as const;

/** Burnout probability above this + high risk → Caregiver Protection Mode. */
export const BURNOUT_PROTECTION_THRESHOLD = 0.65;

/** Composite emotional load score bands for cognitive fatigue classification. */
export const COGNITIVE_FATIGUE_BANDS = {
  LOW: { min: 0, max: 29 },
  MEDIUM: { min: 30, max: 54 },
  HIGH: { min: 55, max: 74 },
  CRITICAL: { min: 75, max: 100 },
} as const;

/** Stress indicator formula weights (each indicator normalized 0–100). */
export const STRESS_INDICATOR_WEIGHTS = {
  situationSwitching: 0.22,
  highUrgencyClustering: 0.24,
  unresolvedConflicts: 0.2,
  escalatingNotifications: 0.17,
  interruptionFrequency: 0.17,
} as const;

/** Burnout probability formula weights (inputs normalized 0–1). */
export const BURNOUT_FORMULA_WEIGHTS = {
  stressComposite: 0.2,
  operationalLoad: 0.18,
  emotionalBias: 0.15,
  depletionFactor: 0.18,
  conflictLoad: 0.14,
  situationSwitching: 0.15,
} as const;

/** Recovery time modeling stub — minutes after resolution before load decays. */
export const RECOVERY_TIME_STUB_MINUTES = {
  LOW: 5,
  MEDIUM: 15,
  HIGH: 45,
  CRITICAL: 120,
} as const;

/** Load-aware priority: temporal weight reduction when deferring under high load. */
export const LOAD_AWARE_TEMPORAL_REDUCTION = 0.25;

/** Max actions on surface under HIGH/CRITICAL cognitive fatigue. */
export const FATIGUE_SURFACE_LIMITS = {
  LOW: 4,
  MEDIUM: 3,
  HIGH: 2,
  CRITICAL: 1,
} as const;
