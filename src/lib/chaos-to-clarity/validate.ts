import type { SolenOSResponse } from "../response-validator";
import { collectCaregiverText, outputImpliesIncompleteContext } from "../solenos-fields";
import type { StressNormalizedOutput } from "../input-stress-normalizer";
import {
  CAUSALITY_INVENTION_PATTERNS,
  CONTRADICTION_RECONCILIATION_PATTERNS,
  INFERENCE_COMPLETION_PATTERNS,
  KNOWLEDGE_COMPLETION_PATTERNS,
  NARRATIVE_SYNTHESIS_PATTERNS,
  REASONING_ENGINE_PATTERNS,
  SUMMARIZER_BEHAVIOR_PATTERNS,
  UNCERTAINTY_SEPARATION_MARKERS,
  type ChaosToClarityResult,
  type ChaosToClarityViolationCode,
} from "./constants";

function matchAny(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function inputHasTag(input: StressNormalizedOutput | undefined, tag: string): boolean {
  return input?.detected_tags.includes(tag as never) ?? false;
}

/** No-inference gate — chaos-to-clarity transformation without narrative completion. */
export function validateChaosToClarity(
  output: SolenOSResponse,
  input?: StressNormalizedOutput,
): ChaosToClarityResult {
  const text = collectCaregiverText(output);
  const violations = new Set<ChaosToClarityViolationCode>();

  if (matchAny(text, NARRATIVE_SYNTHESIS_PATTERNS)) {
    violations.add("narrative_synthesis");
  }

  if (matchAny(text, INFERENCE_COMPLETION_PATTERNS)) {
    violations.add("inference_completion");
  }

  if (matchAny(text, CAUSALITY_INVENTION_PATTERNS)) {
    violations.add("causality_invention");
  }

  if (matchAny(text, REASONING_ENGINE_PATTERNS)) {
    violations.add("reasoning_engine_language");
  }

  if (matchAny(text, SUMMARIZER_BEHAVIOR_PATTERNS)) {
    violations.add("summarizer_behavior");
  }

  if (matchAny(text, KNOWLEDGE_COMPLETION_PATTERNS)) {
    violations.add("knowledge_completion");
  }

  if (
    inputHasTag(input, "CONTRADICTORY_STATEMENTS") &&
    matchAny(text, CONTRADICTION_RECONCILIATION_PATTERNS)
  ) {
    violations.add("contradiction_reconciliation");
  }

  const incomplete =
    inputHasTag(input, "INCOMPLETE_CONTEXT") ||
    inputHasTag(input, "CONTRADICTORY_STATEMENTS") ||
    outputImpliesIncompleteContext(output);

  if (incomplete && !UNCERTAINTY_SEPARATION_MARKERS.test(output.what_is_happening)) {
    violations.add("missing_uncertainty_separation");
  }

  return { valid: violations.size === 0, violations: [...violations] };
}

export function isChaosToClarityValid(
  output: SolenOSResponse,
  input?: StressNormalizedOutput,
): boolean {
  return validateChaosToClarity(output, input).valid;
}
