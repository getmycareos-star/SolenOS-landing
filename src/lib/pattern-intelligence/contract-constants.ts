/** Pattern + Proactive Intelligence — temporal structure detection, not diagnosis. */

export const PATTERN_INTELLIGENCE_IDENTITY =
  "Temporal pattern detection over the Care Journey graph — surfaces structure, not medical meaning.";

export const PATTERN_INTELLIGENCE_BOUNDARY =
  "Detects patterns across structured events only. Never diagnoses, infers causes, or provides medical conclusions.";

export const PROHIBITED_PATTERN_LANGUAGE = [
  "diagnosis",
  "diagnosed with",
  "caused by",
  "likely due to",
  "probably",
  "you should",
  "medical advice",
  "not serious",
  "nothing to worry",
  "low risk",
] as const;

export const DISCUSSION_FRAMING =
  "This pattern may be important to discuss at the next care appointment.";

export const PATTERN_TYPES = [
  "frequency",
  "trend",
  "co_occurrence",
  "escalation",
] as const;

export const PROACTIVE_OUTPUT_TYPES = [
  "missing_data_reminder",
  "follow_up_reminder",
  "risk_pattern_alert",
  "pattern_detected",
  "appointment_near",
] as const;

export const PATTERN_CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;

/** Default time windows (days). */
export const FREQUENCY_WINDOW_DAYS = 30;
export const CO_OCCURRENCE_WINDOW_DAYS = 30;
export const INACTIVITY_THRESHOLD_DAYS = 10;
export const FOLLOW_UP_LOOKAHEAD_DAYS = 7;
