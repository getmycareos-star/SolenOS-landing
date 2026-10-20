export const CRITICAL_TOTAL_MAX_WORDS = 60;
export const HIGH_TOTAL_MAX_WORDS = 120;

export const CRITICAL_HEADER = "🔴 CRITICAL";

export type SafetyOverrideViolationCode =
  | "critical_word_limit_exceeded"
  | "high_word_limit_exceeded"
  | "critical_missing_header"
  | "critical_missing_action"
  | "risk_floor_violation";

export interface SafetyOverrideState {
  active: boolean;
  floor_risk_level: "critical" | "high" | null;
  total_max_words: number | null;
  require_critical_header: boolean;
}

export interface SafetyOverrideCheckResult {
  state: SafetyOverrideState;
  constraint_line: string | null;
}

export interface SafetyOverrideValidationResult {
  valid: boolean;
  violations: SafetyOverrideViolationCode[];
}
