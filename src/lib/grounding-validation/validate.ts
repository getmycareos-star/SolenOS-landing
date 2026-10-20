import type { SolenOSResponse } from "../response-validator";
import type { StressNormalizedOutput } from "../input-stress-normalizer";
import type { ContextWindowOutput } from "../context-window-strategy";
import { detectGroundingViolations } from "./detect";
import type { GroundingValidationResult } from "./constants";

/**
 * Grounding validation — every claim must trace to explicit input or labeled pattern.
 */
export function validateGrounding(
  output: SolenOSResponse,
  input: StressNormalizedOutput,
  contextWindow?: ContextWindowOutput,
): GroundingValidationResult {
  const violations = detectGroundingViolations(output, input, contextWindow);
  return { valid: violations.length === 0, violations };
}

export function isGroundingValid(
  output: SolenOSResponse,
  input: StressNormalizedOutput,
  contextWindow?: ContextWindowOutput,
): boolean {
  return validateGrounding(output, input, contextWindow).valid;
}

