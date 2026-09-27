/**
 * Source Reliability Integration — Architecture Contracts
 */

export const SOURCE_RELIABILITY_INTEGRATION_IDENTITY =
  "Apply source reliability weights to event confidence — hearsay ≠ clinical notes.";

export const SOURCE_RELIABILITY_INTEGRATION_PIPELINE_POSITION = [
  "extract_events",
  "understand_situation",
  "detect_contradictions",
  "materialize_contradictions",
  "compare_baselines",
  "compute_continuity",
  "integrate_source_reliability", // THIS MODULE
  "aggregate_confidence",
  "reason_priorities",
  "compose_response",
] as const;

export const SOURCE_RELIABILITY_INTEGRATION_FORBIDDEN = [
  "average_reliability_blindly",
  "include_unverified_in_reasoning",
  "hide_source_from_caregiver",
] as const;