/**
 * Caregiver Depletion Signals — observational labels only (NOT a system mode).
 */

export const CAREGIVER_DEPLETION_BOUNDARY =
  "caregiver depletion signals are LABEL ONLY — shallow surface-signals for telemetry observation; they do NOT create a system mode, route lifecycle, branch UX, or trigger intervention.";

export const CAREGIVER_DEPLETION_ONE_LINE_TRUTH =
  "Observing caregiver depletion does not change what SolenOS is — it records explicit surface signals for measurement only.";

export const CAREGIVER_DEPLETION_STATES = ["normal", "elevated", "critical"] as const;

export type CaregiverDepletionState = (typeof CAREGIVER_DEPLETION_STATES)[number];

export const ENVIRONMENTAL_DEPENDENCY_FLAGS = ["none", "support_anchor_present"] as const;

export type EnvironmentalDependencyFlag = (typeof ENVIRONMENTAL_DEPENDENCY_FLAGS)[number];

export const CAREGIVER_DEPLETION_ANTI_DRIFT_RULES = [
  "Observing depletion does NOT create a system mode",
  "Depletion signals are LABEL ONLY — no behavioral branching or intervention routing",
  "No UX changes, no lifecycle routing, no output schema changes",
  "Telemetry persistence is observational — not profiling or segmentation",
] as const;

export const CAREGIVER_DEPLETION_FORBIDDEN_USES = [
  "lifecycle routing",
  "UI branching",
  "output schema changes",
  "state machine transitions",
  "user profiling",
  "care journey tracking",
  "segmentation",
  "burnout intervention",
  "caregiver coaching",
  "behavioral nudging",
  "depletion product mode",
] as const;

export const CAREGIVER_DEPLETION_OBSERVATION_TAG_PREFIX = "CAREGIVER_DEPLETION:";
