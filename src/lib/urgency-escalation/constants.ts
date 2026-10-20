export type UrgencyEscalationViolationCode =
  | "missing_escalation"
  | "missing_urgency_header"
  | "missing_immediate_action"
  | "urgency_suppressed"
  | "diagnostic_certainty_in_urgency"
  | "risk_level_mismatch"
  | "hallucinated_severity";

export const URGENCY_ESCALATION_VIOLATION_CODES: readonly UrgencyEscalationViolationCode[] =
  [
    "missing_escalation",
    "missing_urgency_header",
    "missing_immediate_action",
    "urgency_suppressed",
    "diagnostic_certainty_in_urgency",
    "risk_level_mismatch",
    "hallucinated_severity",
  ] as const;

/** Section 4 — signal-based detection (NOT diagnosis). */
export const HIGH_URGENCY_SIGNAL_PATTERNS = [
  /\bchest pain\b/i,
  /\bdifficulty breathing\b/i,
  /\bcannot breathe\b/i,
  /\bcan'?t breathe\b/i,
  /\bblue lips\b/i,
  /\bcyanosis\b/i,
  /\bunconscious(?:ness)?\b/i,
  /\bcollapse(?:d|s|ing)?\b/i,
  /\bfaint(?:ing|ed)?\b/i,
  /\binability to wake\b/i,
  /\bcan'?t wake\b/i,
  /\bsevere sudden confusion\b/i,
  /\boxygen distress\b/i,
  /\boxygen (?:is )?dropping\b/i,
  /\brapidly worsening\b/i,
  /\bseizure(?:-like)?\b/i,
  /\buncontrolled bleeding\b/i,
  /\bstroke[- ]like\b/i,
] as const;

export const CRITICAL_URGENCY_HEADER_PATTERN =
  /(?:🟥\s*)?CRITICAL\s*\/\s*POSSIBLE EMERGENCY/i;

export const HIGH_URGENCY_HEADER_PATTERN =
  /(?:🟥\s*)?(?:HIGH URGENCY|CRITICAL)\s*\/\s*POSSIBLE EMERGENCY/i;

export const ESCALATION_ACTION_MARKERS =
  /\b(seek emergency|contact emergency|call 911|emergency medical care|emergency services|do not delay|urgent medical evaluation|get emergency help)\b/i;

export const URGENCY_SUPPRESSION_PATTERNS = [
  /\bcan sometimes be indigestion\b/i,
  /\bmight be harmless\b/i,
  /\bprobably nothing\b/i,
  /\bno need to rush\b/i,
  /\bnot an emergency\b/i,
  /\bcan wait (?:until|before)\b/i,
  /\blikely fine\b/i,
  /\bnothing serious\b/i,
] as const;

export const DIAGNOSTIC_CERTAINTY_URGENCY_PATTERNS = [
  /\bthis is a heart attack\b/i,
  /\bthis confirms respiratory failure\b/i,
  /\bthis means active dying\b/i,
  /\bthis is definitely an emergency condition\b/i,
  /\bconfirmed (?:heart attack|stroke|seizure)\b/i,
  /\bthis is respiratory failure\b/i,
] as const;

export const ALLOWED_URGENCY_INTERPRETATION_MARKERS =
  /\b(may require urgent|can sometimes occur in medical emergencies|may require emergency evaluation|may require urgent medical evaluation)\b/i;

export interface UrgencyEscalationResult {
  valid: boolean;
  violations: UrgencyEscalationViolationCode[];
  high_urgency_input: boolean;
}

export interface UrgencySignalDetectionResult {
  high_urgency: boolean;
  matched_signals: string[];
}
