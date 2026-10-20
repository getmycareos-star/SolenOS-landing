/**
 * Post-Care Insight Signal — observational label only (NOT a system mode).
 */

export const POST_CARE_INSIGHT_BOUNDARY =
  "care_context_state is LABEL ONLY — a shallow surface-signal for telemetry observation; it does NOT create a system mode, route lifecycle, or branch UX.";

export const POST_CARE_INSIGHT_ONE_LINE_TRUTH =
  "Observing care context does not change what SolenOS is — it records a surface signal for measurement only.";

export const CARE_CONTEXT_STATES = [
  "active_care",
  "crisis",
  "post_care",
  "uncertain",
] as const;

export type CareContextState = (typeof CARE_CONTEXT_STATES)[number];

export const POST_CARE_INSIGHT_ANTI_DRIFT_RULES = [
  "Observing a state does NOT create a system mode",
  "care_context_state is LABEL ONLY — no behavioral branching beyond optional verbosity tweak",
  "No UX changes, no lifecycle routing, no output schema changes",
  "Telemetry persistence is observational — not profiling or segmentation",
] as const;

export const POST_CARE_INSIGHT_FORBIDDEN_USES = [
  "lifecycle routing",
  "UI branching",
  "output schema changes",
  "state machine transitions",
  "user profiling",
  "care journey tracking",
  "segmentation",
  "emotional state engine",
  "post-care product mode",
] as const;

export const POST_CARE_OBSERVATION_TAG_PREFIX = "CARE_CONTEXT_STATE:";

export const POST_CARE_LOW_CONFIDENCE_THRESHOLD = 0.55;
