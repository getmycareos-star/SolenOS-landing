/**
 * TIME WEIGHTING MODEL (CRITICAL SYSTEM RULE)
 *
 * Caregiving time is NOT linear. Time multiplies consequence.
 * WRONG: risk = baseRisk + time
 * CORRECT: risk = baseRisk × timeCurve(situationType, t)
 */

export const TIME_WEIGHTING_IDENTITY =
  "a pure derived time-curve layer that multiplies base risk by situation-specific non-linear curves — never invents urgency, never flattens deadlines equally";

export const TIME_WEIGHTING_ONE_LINE_TRUTH =
  "RiskOverTime(t) = BaseRisk × TimeCurveType(t); Priority Contract consumes curve-derived urgency, not baseRisk + time.";

export const TIME_WEIGHTING_PIPELINE_POSITION =
  "TIME WEIGHTING — derived after Time Engine / situation classification; feeds Priority Contract TimeUrgency × TimeDecayFactor (curve path)";

export const TIME_WEIGHTING_FORBIDDEN = [
  "flatten all deadlines equally",
  "use only baseRisk + time",
  "let LLM invent urgency",
  "persist time curves as an independent engine",
  "schedule events or generate reminders",
] as const;

/** Canonical curve classes. */
export const TIME_CURVE_TYPES = [
  "ACUTE_MEDICAL",
  "MEDICATION_DEPENDENT",
  "CHRONIC_CARE",
  "SOCIAL_COORDINATION",
  "SAFETY_CRITICAL_OVERRIDE",
] as const;

/** Default exponential growth rates (k). */
export const CURVE_K_DEFAULTS = {
  /** Acute medical: discharge, surgery, post-op — explodes quickly. */
  ACUTE_MEDICAL: 1.1,
  /** Medication-dependent: insulin, anticoagulants, epilepsy — higher. */
  MEDICATION_DEPENDENT: 1.6,
} as const;

export const CURVE_K_RANGES = {
  ACUTE_MEDICAL: { min: 0.8, max: 1.5 },
  MEDICATION_DEPENDENT: { min: 1.2, max: 2.0 },
} as const;

/** Step-function floor before threshold (stable). */
export const SAFETY_STEP_FLOOR = 0.05;

/** Step-function ceiling after critical threshold (MAX). */
export const SAFETY_STEP_MAX = 1.0;

/**
 * Default thresholds (hours until deadline) — medication refill style.
 * safe ≥ 72h, warning at 24h, critical < 6h.
 */
export const DEFAULT_THRESHOLDS_HOURS = {
  safeThresholdTime: 72,
  warningThresholdTime: 24,
  criticalThresholdTime: 6,
} as const;

/** Curve-specific default threshold packs (hours remaining). */
export const CURVE_DEFAULT_THRESHOLDS = {
  ACUTE_MEDICAL: {
    safeThresholdTime: 48,
    warningThresholdTime: 12,
    criticalThresholdTime: 4,
  },
  MEDICATION_DEPENDENT: {
    safeThresholdTime: 72,
    warningThresholdTime: 24,
    criticalThresholdTime: 6,
  },
  CHRONIC_CARE: {
    safeThresholdTime: 168,
    warningThresholdTime: 72,
    criticalThresholdTime: 24,
  },
  SOCIAL_COORDINATION: {
    safeThresholdTime: 120,
    warningThresholdTime: 48,
    criticalThresholdTime: 12,
  },
  SAFETY_CRITICAL_OVERRIDE: {
    safeThresholdTime: 24,
    warningThresholdTime: 12,
    criticalThresholdTime: 6,
  },
} as const;

/** Soft multi-situation interaction (v1.5 optional). */
export const MULTI_SITUATION_ELEVATION = {
  /** Two moderate curve risks (0.4–0.7) → elevated floor. */
  moderateBandMin: 0.4,
  moderateBandMax: 0.7,
  elevatedFloor: 0.75,
} as const;
