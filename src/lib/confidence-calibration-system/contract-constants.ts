/** Confidence Calibration System — computed probability of correctness, not a static label. */

export const CONFIDENCE_CALIBRATION_IDENTITY =
  "Confidence in SolenOS is a continuously evolving measurement of evidence strength under time, contradiction, and reinforcement dynamics.";

export const CONFIDENCE_CALIBRATION_DEFINING_PRINCIPLE =
  "Confidence is a computed, continuously updated probability of correctness — not a static attribute.";

export const SOURCE_TYPE_WEIGHTS = {
  medical_professional: 0.95,
  caregiver_direct_observation: 0.8,
  reported_second_hand: 0.65,
  system_inference: 0.5,
  unverified_input: 0.4,
} as const;

export type SourceTypeWeight = keyof typeof SOURCE_TYPE_WEIGHTS;

export const CONFIDENCE_FLOOR = 0.15;
export const CONFIDENCE_CEILING = 0.95;
/** Inferred data cannot exceed this relative to observed ceiling */
export const INFERENCE_CEILING = 0.75;

/** Decay half-life in days for stable conditions */
export const STABLE_DECAY_HALF_LIFE_DAYS = 30;
/** Faster decay for high-risk contexts */
export const HIGH_RISK_DECAY_HALF_LIFE_DAYS = 7;

export const CONFIRMATION_BOOST = 0.08;
export const CONTRADICTION_PENALTY = 0.18;
export const COMPLETENESS_PENALTY_PER_MISSING = 0.06;

export const CONFIDENCE_CALIBRATION_RULES = [
  "deterministic_scoring_function",
  "observations_dominate_inference",
  "recency_decay_required",
  "confirmation_boosts_stability",
  "contradiction_reduces_certainty",
  "incomplete_context_lowers_ceiling",
  "no_manual_assignment_in_production",
  "floor_and_ceiling_enforced",
] as const;
