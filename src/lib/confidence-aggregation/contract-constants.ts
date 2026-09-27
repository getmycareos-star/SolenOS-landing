/**
 * Confidence Aggregation — Architecture Contracts
 */

export const CONFIDENCE_AGGREGATION_IDENTITY =
  "Unified confidence scoring across all reasoning modules — evidence, contradictions, baselines, continuity.";

export const CONFIDENCE_AGGREGATION_PIPELINE_POSITION = [
  "extract_events",
  "understand_situation",
  "detect_contradictions",
  "compare_baselines",
  "compute_continuity",
  "aggregate_confidence", // THIS MODULE
  "reason_priorities",
  "compose_response",
] as const;

export const CONFIDENCE_AGGREGATION_FORBIDDEN = [
  "caregiving_confidence_percentage",
  "health_score",
  "performance_rating",
  "gamified_badge_or_streak",
  "surface_raw_percentage_to_caregiver",
] as const;