import type { SolenOSResponse } from "../response-validator";
import { RISK_RANK } from "../implementation-enforcement/risk-levels";
import type { SafetyOverrideState } from "./constants";
import {
  CRITICAL_HEADER,
  CRITICAL_TOTAL_MAX_WORDS,
  HIGH_TOTAL_MAX_WORDS,
  type SafetyOverrideValidationResult,
  type SafetyOverrideViolationCode,
} from "./constants";

function countTotalWords(output: SolenOSResponse): number {
  const text = [
    output.what_is_happening,
    output.what_matters_now,
    output.what_to_ask_next,
    output.what_can_wait,
  ].join(" ");
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function hasImmediateAction(text: string): boolean {
  return /\b(call 911|seek emergency|emergency services|immediate|do not delay|get emergency help)\b/i.test(
    text,
  );
}

export function validateSafetyOverrideOutput(
  output: SolenOSResponse,
  state: SafetyOverrideState,
): SafetyOverrideValidationResult {
  if (!state.active) {
    return { valid: true, violations: [] };
  }

  const violations: SafetyOverrideViolationCode[] = [];

  if (
    state.floor_risk_level &&
    RISK_RANK[output.risk_level] < RISK_RANK[state.floor_risk_level]
  ) {
    violations.push("risk_floor_violation");
  }

  const totalWords = countTotalWords(output);

  if (state.floor_risk_level === "critical") {
    if (totalWords > CRITICAL_TOTAL_MAX_WORDS) {
      violations.push("critical_word_limit_exceeded");
    }
    if (!output.what_matters_now.includes(CRITICAL_HEADER)) {
      violations.push("critical_missing_header");
    }
    if (!hasImmediateAction(output.what_matters_now)) {
      violations.push("critical_missing_action");
    }
  }

  if (state.floor_risk_level === "high" && totalWords > HIGH_TOTAL_MAX_WORDS) {
    violations.push("high_word_limit_exceeded");
  }

  return { valid: violations.length === 0, violations };
}

export function isSafetyOverrideValid(
  output: SolenOSResponse,
  state: SafetyOverrideState,
): boolean {
  return validateSafetyOverrideOutput(output, state).valid;
}
