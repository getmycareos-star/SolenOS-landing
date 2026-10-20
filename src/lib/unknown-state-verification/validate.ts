import type { SolenOSResponse } from "../response-validator";
import type { StressNormalizedOutput } from "../input-stress-normalizer";
import { outputImpliesIncompleteContext } from "../solenos-fields";
import {
  FALSE_CERTAINTY_WITH_UNKNOWN_PATTERNS,
  UNKNOWN_STATE_MARKERS,
  type UnknownStateValidationResult,
  type UnknownStateViolationCode,
} from "./constants";

function matchAny(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function isIncompleteContext(
  output: SolenOSResponse,
  input?: StressNormalizedOutput,
): boolean {
  if (outputImpliesIncompleteContext(output)) return true;
  if (!input) return false;
  return (
    input.detected_tags.includes("INCOMPLETE_CONTEXT") ||
    input.detected_tags.includes("CONTRADICTORY_STATEMENTS")
  );
}

/** Uncertainty separation check — unknowns remain unknown when context is incomplete. */
export function verifyUnknownState(
  output: SolenOSResponse,
  input?: StressNormalizedOutput,
): UnknownStateValidationResult {
  const violations = new Set<UnknownStateViolationCode>();

  if (!isIncompleteContext(output, input)) {
    return { valid: true, violations: [] };
  }

  const combined = `${output.what_is_happening} ${output.what_matters_now}`;

  if (!UNKNOWN_STATE_MARKERS.test(combined)) {
    violations.add("unknown_state_not_preserved");
  }

  if (matchAny(combined, FALSE_CERTAINTY_WITH_UNKNOWN_PATTERNS)) {
    violations.add("false_certainty_with_incomplete_context");
  }

  if (
    /\b(is|has|was|will be|confirmed)\b/i.test(output.what_is_happening) &&
    !UNKNOWN_STATE_MARKERS.test(output.what_is_happening)
  ) {
    violations.add("premature_closure");
  }

  return { valid: violations.size === 0, violations: [...violations] };
}

export function isUnknownStateValid(
  output: SolenOSResponse,
  input?: StressNormalizedOutput,
): boolean {
  return verifyUnknownState(output, input).valid;
}
