import type { SolenOSResponse } from "../response-validator";
import type { StressNormalizedOutput } from "../input-stress-normalizer";
import { collectCaregiverText } from "../solenos-fields";
import { detectEmotionalInput } from "./detect";
import {
  EMOTIONAL_EXAGGERATION_PATTERNS,
  FORBIDDEN_DEPENDENCY_PATTERNS,
  FORBIDDEN_THERAPEUTIC_PATTERNS,
  type EmotionalStabilizationResult,
  type EmotionalStabilizationViolationCode,
} from "./constants";

function matchAny(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

/** Forbid therapeutic simulation — emotional state may only be restated in what_is_happening via paraphrase. */
export function validateEmotionalStabilization(
  output: SolenOSResponse,
  input: StressNormalizedOutput,
): EmotionalStabilizationResult {
  const emotional_input = detectEmotionalInput(input);
  const text = collectCaregiverText(output);
  const violations = new Set<EmotionalStabilizationViolationCode>();

  if (matchAny(text, FORBIDDEN_THERAPEUTIC_PATTERNS)) {
    violations.add("therapeutic_simulation");
  }

  if (matchAny(text, FORBIDDEN_DEPENDENCY_PATTERNS)) {
    violations.add("dependency_framing");
  }

  if (matchAny(text, EMOTIONAL_EXAGGERATION_PATTERNS)) {
    violations.add("emotional_exaggeration");
  }

  if (emotional_input && matchAny(output.what_is_happening, FORBIDDEN_THERAPEUTIC_PATTERNS)) {
    violations.add("factual_only_on_distress");
  }

  return { valid: violations.size === 0, violations: [...violations], emotional_input };
}

export function isEmotionalStabilizationValid(
  output: SolenOSResponse,
  input: StressNormalizedOutput,
): boolean {
  return validateEmotionalStabilization(output, input).valid;
}
