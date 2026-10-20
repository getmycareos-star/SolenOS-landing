/** Edge State Machine — operational state before interpretation. */

export const EDGE_STATE_IDENTITY =
  "SolenOS must always declare its operational state before producing interpretation.";

export const EDGE_STATE_DEFINING_PRINCIPLE =
  "Edge states are not exceptions — they are the primary operating conditions of caregiving reality.";

export const EDGE_STATES = [
  "crisis",
  "conflict",
  "stale",
  "degraded",
  "bootstrap",
  "normal",
] as const;

/** Classification priority — first match wins (crisis highest). */
export const EDGE_STATE_CLASSIFICATION_ORDER = [
  "crisis",
  "conflict",
  "stale",
  "bootstrap",
  "degraded",
  "normal",
] as const;

export const EDGE_STATE_RULES = [
  "exactly_one_edge_state_per_cycle",
  "state_declared_before_output",
  "per_state_engine_activation",
  "per_state_output_restrictions",
  "no_cross_state_behavior_leakage",
] as const;

/** Days without events → stale mode threshold */
export const STALE_THRESHOLD_DAYS = 7;

/** Minimum events before leaving degraded/bootstrap toward normal */
export const DEGRADED_MIN_EVENTS = 3;
