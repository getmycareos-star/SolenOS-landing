/** Activation system boundaries — retention without guilt or gamification. */

export const TRUST_STAGE_EARLY_MAX = 4;
export const TRUST_STAGE_BUILDING_MAX = 19;

export const REENGAGEMENT_INACTIVE_DAYS = 14;
export const HABIT_WINDOW_MIN_ENTRIES = 3;
export const HABIT_WINDOW_HOUR_TOLERANCE = 1;

export const ACTIVATION_ACKNOWLEDGEMENT =
  "Held in the Living Care Record.";

export const REENGAGEMENT_MESSAGES = [
  "Anything new for the Living Care Record?",
  "We can pick up where you left off.",
  "Anything changed since last time?",
] as const;

export const FORBIDDEN_REENGAGEMENT_COPY = [
  "We miss you",
  "Your streak ended",
  "You haven't checked in",
  "You are falling behind",
  "Don't break your progress",
] as const;

export const APPOINTMENT_PROMPT =
  "Anything from today's appointment worth recording?";

export const RESOLUTION_PROMPT =
  "That issue looks resolved. Anything else you're carrying?";

export const HABIT_WINDOW_PROMPT_EVENING =
  "Anything worth adding to the Living Care Record this evening?";
export const HABIT_WINDOW_PROMPT_MORNING =
  "Anything worth adding to the Living Care Record this morning?";
export const HABIT_WINDOW_PROMPT_DEFAULT =
  "Anything worth adding to the Living Care Record?";

export const ACTIVATION_FORBIDDEN = [
  "streaks",
  "badges",
  "points",
  "gamification",
  "daily reminders",
  "generic push notifications",
  "engagement campaigns",
  "morning check-ins",
  "streak reminders",
  "mandatory onboarding forms",
  "profile completion flows",
] as const;
