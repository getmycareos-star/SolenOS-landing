/** Current State View — retention core: what is going on right now. */

export const CURRENT_STATE_VIEW_IDENTITY =
  "The ONLY screen that matters for retention — what is going on with this person right now.";

export const CURRENT_STATE_VIEW_DEFINING_PRINCIPLE =
  "No chat. No feed. No journaling UI. Only current state.";

export const CURRENT_STATE_VIEW_RULES = [
  "active_medications_only",
  "recent_changes_7_days",
  "open_tasks_surfaced",
  "unresolved_issues_visible",
  "no_raw_event_noise",
] as const;
