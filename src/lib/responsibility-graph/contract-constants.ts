/**
 * Responsibility Graph (v1.7) — STATE ownership map.
 * Answers: Who is responsible for what?
 * Ownership is objective STATE; conflicts/unassigned flags influence BELIEF/uncertainty.
 */

export const RESPONSIBILITY_GRAPH_IDENTITY =
  "Responsibility Graph makes accountability explicit — operational ownership map, not a contact list";

export const RESPONSIBILITY_GRAPH_ONE_LINE_TRUTH =
  "Person → Responsibility → Demand → Situation. Ownership is STATE; unassigned/high-pressure gaps escalate.";

export const RESPONSIBILITY_GRAPH_PIPELINE_POSITION =
  "Situation Engine → Demand Engine → Responsibility Graph → Priority Engine → Decision Engine";

export const RESPONSIBILITY_GRAPH_ARCHITECTURE_LAYER = "STATE" as const;

export const RESPONSIBILITY_GRAPH_FORBIDDEN = [
  "contact-list UI as the primary surface",
  "delegation / ownership transfer / backup owner (MVP)",
  "availability forecasting",
  "auto-reassignment",
  "treating Responsibility Graph as an unbounded independent engine forever",
] as const;

export const RESPONSIBILITY_STATUSES = [
  "assigned",
  "accepted",
  "in_progress",
  "completed",
  "failed",
] as const;

export const OWNERSHIP_STATES = [
  "assigned",
  "unassigned",
  "shared",
  "blocked",
] as const;

export const RESPONSIBILITY_HEALTH_STATES = [
  "healthy",
  "at_risk",
  "critical",
] as const;

/** Align with Demand Engine high-pressure threshold. */
export const HIGH_PRESSURE_RESPONSIBILITY_THRESHOLD = 70;

/** Soft load warning — not auto-reassignment. */
export const LOAD_OVERLOAD_SCORE_THRESHOLD = 8;
