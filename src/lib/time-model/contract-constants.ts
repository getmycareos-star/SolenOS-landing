/** SolenOS dual time model — event_time vs ingestion_time. */

export const TIME_MODEL_IDENTITY =
  "Time is a conflicting interpretation system that preserves both truth and uncertainty.";

export const EVENT_TIME_TYPES = ["exact", "approximate", "range", "unknown"] as const;

export const RETIMING_REASONS = [
  "user_correction",
  "retrospective_update",
  "late_arrival",
] as const;

export const PATTERN_WINDOW_ANCHOR = "event_time" as const;
