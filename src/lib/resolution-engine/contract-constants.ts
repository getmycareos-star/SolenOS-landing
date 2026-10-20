/** Resolution Engine — lifecycle ownership for operational situations. */

export const RESOLUTION_ENGINE_LAYER_IDENTITY =
  "a situation lifecycle layer that determines when a situation is no longer operationally active — completeness requires evidence of outcome achieved, abandoned, or superseded, never time or inactivity";

export const RESOLUTION_ENGINE_LAYER_ONE_LINE_TRUTH =
  "A situation is complete because its outcome has been achieved, abandoned, or superseded — never because time passed or the user went quiet.";

export const RESOLUTION_ENGINE_LAYER_PIPELINE_POSITION =
  "RESOLUTION ENGINE LAYER — after Care Context / identity continuity signals; filters ACTIVE situations for Priority Engine and Risk consumers; before Action Generator";

export const RESOLUTION_ENGINE_LAYER_FORBIDDEN = [
  "auto-resolve because elapsed time passed",
  "auto-resolve because of inactivity",
  "auto-resolve because of lack of user interaction",
  "auto-resolve because of low confidence",
  "auto-resolve from system assumptions without evidence",
  "delete timeline, memory, or documents on resolve or archive",
  "resurrect ARCHIVED situations — create a new ACTIVE situation instead",
  "reverse transitions RESOLVED→ACTIVE or ARCHIVED→RESOLVED automatically",
] as const;

export const SITUATION_LIFECYCLE_STATUSES = ["ACTIVE", "RESOLVED", "ARCHIVED"] as const;

/** Valid evidence kinds for ACTIVE → RESOLVED. */
export const RESOLUTION_EVIDENCE_KINDS = [
  "COMPLETION_EVENT",
  "APPROVAL_EVENT",
  "FULFILLMENT_EVENT",
  "USER_CONFIRMATION",
  "SUPERSEDING_EVENT",
] as const;

/** Triggers that MUST NEVER cause auto-resolution. */
export const FORBIDDEN_RESOLUTION_TRIGGERS = [
  "ELAPSED_TIME",
  "INACTIVITY",
  "LACK_OF_USER_INTERACTION",
  "LOW_CONFIDENCE",
  "SYSTEM_ASSUMPTION",
] as const;

/** Default retention window before RESOLVED may archive (days) — archival optimization only. */
export const DEFAULT_RETENTION_DAYS = 30;

/** ACTIVE situations must be reevaluated at least this often (ms) for system guarantee. */
export const REEVALUATION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
