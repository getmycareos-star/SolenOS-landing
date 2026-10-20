export type UnknownStateViolationCode =
  | "unknown_state_not_preserved"
  | "false_certainty_with_incomplete_context"
  | "premature_closure";

export const UNKNOWN_STATE_VIOLATION_CODES: readonly UnknownStateViolationCode[] = [
  "unknown_state_not_preserved",
  "false_certainty_with_incomplete_context",
  "premature_closure",
] as const;

export const UNKNOWN_STATE_MARKERS =
  /\b(unknown|uncertain|uncertainty|unclear|cannot be determined|missing|not stated|limits of|without knowing|requires clarification|incomplete)\b/i;

export const FALSE_CERTAINTY_WITH_UNKNOWN_PATTERNS = [
  /\b(definitely|certainly|confirmed|is known to be|without doubt)\b/i,
  /\bthis is (?:the |a )?(?:answer|truth|diagnosis|cause)\b/i,
] as const;

export interface UnknownStateValidationResult {
  valid: boolean;
  violations: UnknownStateViolationCode[];
}
