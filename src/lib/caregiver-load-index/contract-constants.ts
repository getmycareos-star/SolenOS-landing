/**
 * Caregiver Load Index (v1.6) — DERIVED operational burden measure.
 * NOT mental health diagnosis / therapy / emotional support.
 * Changes Decision Surface recommendation count; never a dashboard KPI reasoner.
 */

export const CAREGIVER_LOAD_INDEX_IDENTITY =
  "Caregiver Load Index measures operational caregiver burden from demands, uncertainty, conflict, coordination, and time pressure — not mental health";

export const CAREGIVER_LOAD_INDEX_ONE_LINE_TRUTH =
  "CLI is a derived function over STATE (demands/situations) + BELIEF (uncertainty); it shapes recommendation count, never diagnoses or persists as an engine.";

export const CAREGIVER_LOAD_INDEX_PIPELINE_POSITION =
  "Situation → Demand → Caregiver Load Index → Priority → Decision → Decision Surface";

export const CAREGIVER_LOAD_INDEX_FORBIDDEN = [
  "mental health diagnosis",
  "therapy / emotional support routing",
  "fatigueTrend / burnoutRisk / sleep / confidence (v2 only)",
  "persistent load dashboard as system of record",
  "using CLI as explanation reasoner",
] as const;

export const CAREGIVER_LOAD_STATES = [
  "LOW",
  "MODERATE",
  "HIGH",
  "CRITICAL",
] as const;

/** Recommendation count by load state for Decision Surface. */
export const LOAD_STATE_SURFACE_LIMITS = {
  LOW: 4,
  MODERATE: 3,
  HIGH: 2,
  CRITICAL: 1,
} as const;

export const LOAD_SCORE_BANDS = {
  LOW: { min: 0, max: 25 },
  MODERATE: { min: 26, max: 50 },
  HIGH: { min: 51, max: 75 },
  CRITICAL: { min: 76, max: 100 },
} as const;

/** Formula v1 coefficients. */
export const LOAD_FORMULA_WEIGHTS = {
  activeDemandCount: 1.5,
  highPressureDemandCount: 4,
  uncertaintyLoad: 0.2,
  conflictLoad: 0.2,
  coordinationLoad: 0.15,
  timePressureLoad: 0.15,
} as const;
