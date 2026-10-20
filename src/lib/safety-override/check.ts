import type { UrgencyDetectionResult } from "../urgency-detection";
import type { BehaviorProfile } from "../input-classification";
import {
  CRITICAL_HEADER,
  CRITICAL_TOTAL_MAX_WORDS,
  HIGH_TOTAL_MAX_WORDS,
  type SafetyOverrideCheckResult,
  type SafetyOverrideState,
} from "./constants";

export function buildSafetyOverrideState(
  urgency: UrgencyDetectionResult,
): SafetyOverrideState {
  if (urgency.risk_level === "critical") {
    return {
      active: true,
      floor_risk_level: "critical",
      total_max_words: CRITICAL_TOTAL_MAX_WORDS,
      require_critical_header: true,
    };
  }

  if (urgency.risk_level === "high") {
    return {
      active: true,
      floor_risk_level: "high",
      total_max_words: HIGH_TOTAL_MAX_WORDS,
      require_critical_header: false,
    };
  }

  return {
    active: false,
    floor_risk_level: null,
    total_max_words: null,
    require_critical_header: false,
  };
}

/** Safety override check — runs before structured output generation. */
export function applySafetyOverrideCheck(
  urgency: UrgencyDetectionResult,
  _profile: BehaviorProfile,
): SafetyOverrideCheckResult {
  const state = buildSafetyOverrideState(urgency);

  if (!state.active) {
    return { state, constraint_line: null };
  }

  if (state.floor_risk_level === "critical") {
    return {
      state,
      constraint_line: [
        `SAFETY_OVERRIDE: CRITICAL`,
        `MAX_TOTAL_WORDS: ${CRITICAL_TOTAL_MAX_WORDS}`,
        `REQUIRED_HEADER: ${CRITICAL_HEADER}`,
        `FORMAT: immediate action + minimal context only`,
      ].join(" | "),
    };
  }

  return {
    state,
    constraint_line: [
      `SAFETY_OVERRIDE: HIGH`,
      `MAX_TOTAL_WORDS: ${HIGH_TOTAL_MAX_WORDS}`,
      `INCLUDE: risk signal, what matters, minimal interpretation, action guidance`,
    ].join(" | "),
  };
}

export function formatSafetyOverrideConstraint(
  check: SafetyOverrideCheckResult,
): string | null {
  return check.constraint_line;
}
