/** Situation Risk Register — systemic caregiving risk exposure across ACTIVE situations. */

export const SITUATION_RISK_REGISTER_LAYER_IDENTITY =
  "a runtime aggregation layer that computes systemic caregiving risk exposure across multiple ACTIVE situations — not UI badges, per-situation labels alone, or static priority tags";

export const SITUATION_RISK_REGISTER_LAYER_ONE_LINE_TRUTH =
  "Risk Register answers the total risk burden the user is currently operating under — aggregated across ACTIVE situations with overlap, uncertainty, and dependency multipliers.";

export const SITUATION_RISK_REGISTER_LAYER_PIPELINE_POSITION =
  "SITUATION RISK REGISTER — after Resolution (ACTIVE filter) + Missing Information + Assumption Registry; before/into Priority Engine as a GLOBAL modifier";

export const SITUATION_RISK_REGISTER_LAYER_FORBIDDEN = [
  "UI badges as the sole risk representation",
  "independent per-situation HIGH/MEDIUM labels without aggregation",
  "static priority tags without systemic computation",
  "including RESOLVED or ARCHIVED situations in active risk",
  "treating risk as cosmetic metadata only",
] as const;

export const BASE_RISK_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

/** Overload threshold — totalRiskExposure above this → overload HIGH. */
export const OVERLOAD_RISK_THRESHOLD = 75;

/** Overlap penalty per HIGH/CRITICAL situation in a high-risk cluster (8–15%). */
export const OVERLAP_PENALTY_MIN_PCT = 8;
export const OVERLAP_PENALTY_MAX_PCT = 15;

/** Uncertainty penalty scale — missingInfoWeight × 0.6. */
export const UNCERTAINTY_PENALTY_COEFFICIENT = 0.6;

/** Shared care dependency multiplier — numberOfSharedCareDependencies × 5%. */
export const DEPENDENCY_MULTIPLIER_PCT = 5;

/** Assumption instability boost to adjustedRisk / volatility (0–1 factor). */
export const ASSUMPTION_INSTABILITY_VOLATILITY_WEIGHT = 0.35;

/** Global Priority Engine weight for system risk exposure (0–1 applied to exposure/100). */
export const SYSTEM_RISK_EXPOSURE_PRIORITY_WEIGHT = 0.25;

/** When overload HIGH, Priority Engine top-N collapses to this range. */
export const OVERLOAD_PRIORITY_TOP_N = 2;

/** Driver weights for per-situation adjustedRisk (must sum ≈ 1). */
export const SITUATION_RISK_DRIVER_WEIGHTS = {
  urgency: 0.28,
  medicalSeverity: 0.22,
  dependencyLevel: 0.18,
  timeSensitivity: 0.16,
  uncertaintyFactor: 0.16,
} as const;
