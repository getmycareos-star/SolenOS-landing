/** Retention Engine — return value loop: what changed while I was gone? */

export const RETENTION_ENGINE_IDENTITY =
  "What changed while I was gone? must be the default entry experience.";

export const RETENTION_ENGINE_DEFINING_PRINCIPLE =
  "Every absence creates information delta. That delta is the product.";

export const RETURN_STATE_SECTIONS = [
  "what_changed_since_last_visit",
  "what_got_worse",
  "what_got_better",
  "what_needs_action_now",
  "what_is_stable",
] as const;

export const RETENTION_RULES = [
  "no_greetings_on_return",
  "no_welcome_back_chat",
  "no_empty_dashboard",
  "no_static_view_without_delta",
  "compute_not_store_summary",
  "max_three_action_items",
] as const;

export const MAX_RETURN_ACTION_ITEMS = 3;

/** Minimum inactivity before return delta is meaningful (ms) */
export const RETURN_DELTA_THRESHOLD_MS = 60 * 60 * 1000;
