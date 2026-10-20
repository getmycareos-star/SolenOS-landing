/** Memory Reconstruction Engine — temporal reconstruction, not search. */

export const MRE_IDENTITY =
  "Temporal reconstruction system that rebuilds caregiving history from structured events across time — not keyword search or document retrieval.";

export const MRE_BOUNDARY =
  "Answers 'What happened over time?' from the Care Journey only. Never invent events, symptoms, or outcomes.";

export const RECONSTRUCTION_TYPES = [
  "event_onset",
  "progression",
  "causality",
  "comparison",
  "last_known_state",
  "general_timeline",
] as const;

export const TREND_VALUES = [
  "ongoing",
  "improving",
  "worsening",
  "fluctuating",
  "stable",
  "unknown",
] as const;

export const CONFIDENCE_LEVELS = [
  "high",
  "medium",
  "low",
  "insufficient_data",
] as const;
