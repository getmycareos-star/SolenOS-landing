/**
 * Contradiction Materialization — Architecture Contracts
 */

export const CONTRADICTION_MATERIALIZATION_IDENTITY =
  "Convert detected contradictions into caregiver-facing clarification — never hide conflicts in system state.";

export const CONTRADICTION_MATERIALIZATION_PIPELINE_POSITION = [
  "extract_events",
  "understand_situation",
  "detect_contradictions",
  "materialize_contradictions", // THIS MODULE
  "compare_baselines",
  "compute_continuity",
  "aggregate_confidence",
  "reason_priorities",
  "compose_response",
] as const;

export const CONTRADICTION_MATERIALIZATION_FORBIDDEN = [
  "hide_contradictions_from_caregiver",
  "auto_resolve_without_clarification",
  "present_uncertainty_as_certainty",
] as const;