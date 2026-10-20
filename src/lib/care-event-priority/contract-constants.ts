/** Deterministic ranking over CareEvents — NOT AI reasoning. */

export const CARE_EVENT_PRIORITY_IDENTITY =
  "A prioritization layer over an evolving event graph that decides what deserves human attention at any moment.";

export const PRIORITY_TIERS = ["CRITICAL", "IMPORTANT", "CONTEXTUAL", "BACKGROUND"] as const;

export const ATTENTION_STATUSES = ["active", "provisional", "resolved", "invalidated"] as const;

export const DEFAULT_UNCERTAINTY = 70;
export const DEFAULT_URGENCY = 30;
export const DEFAULT_DEPENDENCY_COUNT = 1;
export const PROVISIONAL_UNCERTAINTY = 80;

export const CRITICAL_THRESHOLD = 80;
export const IMPORTANT_THRESHOLD = 50;
export const CONTEXTUAL_THRESHOLD = 20;

export const UI_SURFACE_LIMIT = 5;
export const ATTENTION_PANEL_THRESHOLD = 80;

/** Weights — ONLY allowed computation (spec §2). */
export const PRIORITY_WEIGHTS = {
  urgency: 0.35,
  uncertainty: 0.25,
  dependency: 0.25,
  recency: 0.15,
} as const;
