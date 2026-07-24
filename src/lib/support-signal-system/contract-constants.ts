/**
 * SolenOS Support Signal System (SSS v1) — lightweight relief extension.
 * Notifications exist ONLY to reduce cognitive burden during prolonged uncertainty.
 * Default: no notification. Silence preferred.
 */

export const SUPPORT_SIGNAL_PURPOSE =
  "contextual support signals, cognitive decompression prompts, and uncertainty-reduction interventions — ONLY during prolonged uncertainty";

export const SUPPORT_SIGNAL_ONE_LINE_TRUTH =
  "Default is silence; a support signal fires only when observational evidence shows clear value in reducing cognitive burden — never for engagement, habit, or retention.";

export const SUPPORT_SIGNAL_SUCCESS_DEFINITION =
  "Cognitive burden is reduced during prolonged uncertainty without creating dependency, habit loops, or product-mode branching.";

export const SUPPORT_SIGNAL_FORBIDDEN_USES = [
  "reminders",
  "motivational messages",
  "engagement",
  "habit-forming prompts",
  "retention optimization",
  "guilt induction",
  "praise addiction",
  "emotional dependency",
  "artificial intimacy",
  "LLM-generated notification text",
  "behavioral profiling",
  "UI mode triggering",
  "product behavior routing",
  "lifecycle routing",
  "analyze output schema changes",
  "engagement score",
  "dependency tracking",
] as const;

export const SUPPORT_SIGNAL_ANTI_DRIFT_RULES = [
  "SupportState is for notification selection ONLY — NOT product behavior or UI modes",
  "Input signals are observational only — not behavioral profiling",
  "Static MessageTemplate text only — never LLM-generated",
  "When uncertain, do NOT send",
  "Default = no notification; silence preferred",
  "Telemetry records delivery/suppression only — no engagement or retention metrics",
  "No changes to analyze output schema",
  "Actual push delivery infrastructure is out of scope for MVP",
] as const;

export const SUPPORT_STATES = [
  "crisis",
  "overload",
  "fatigue",
  "stable",
  "reentry",
] as const;

export type SupportState = (typeof SUPPORT_STATES)[number];

export const MESSAGE_TEMPLATE_CATEGORIES = [
  "crisis",
  "overload",
  "fatigue",
  "stable",
  "reentry",
] as const;

export type MessageTemplateCategory = (typeof MESSAGE_TEMPLATE_CATEGORIES)[number];

export const TIME_OF_DAY_BUCKETS = [
  "morning",
  "afternoon",
  "night",
  "late_night",
] as const;

export type TimeOfDay = (typeof TIME_OF_DAY_BUCKETS)[number];

/** Days of inactivity before re-entry may be considered (prolonged absence). */
export const REENTRY_INACTIVITY_DAYS_THRESHOLD = 7;

/** Minimum hours since last delivered notification before another may send. */
export const RECENT_NOTIFICATION_SUPPRESSION_HOURS = 24;

/** Stabilization: rare periodic after sustained elevated/critical pressure (days). */
export const STABILIZATION_SUSTAINED_PRESSURE_DAYS = 3;

export const SUPPORT_SIGNAL_TELEMETRY_ALLOWED_FIELDS = [
  "notification_id",
  "category",
  "delivered_at",
  "suppressed",
] as const;

export const SUPPORT_SIGNAL_TELEMETRY_FORBIDDEN_FIELDS = [
  "engagement_score",
  "habit_formation",
  "retention_optimization",
  "dependency_tracking",
  "open_rate",
  "click_rate",
  "session_streak",
] as const;
