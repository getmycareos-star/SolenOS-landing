import type { SolenOSResponse } from "../response-validator";
import { collectCaregiverText, hasClarifyingQuestion, outputImpliesIncompleteContext } from "../solenos-fields";
import {
  ESCALATION_PATHWAY_MARKERS,
  GUARANTEE_LANGUAGE_PATTERNS,
  LOW_RISK_FALSE_SAFETY_PATTERNS,
  MIN_USEFUL_PRIORITIZATION_LENGTH,
  OUTCOME_REASSURANCE_PATTERNS,
  PANIC_AMPLIFICATION_PATTERNS,
  PARALYSIS_PATTERNS,
  PRIORITIZATION_MARKERS,
  RESOLVED_UNCERTAINTY_PATTERNS,
  type CalibratedUncertaintyResult,
  type CalibratedUncertaintyViolationCode,
} from "./constants";

function matchAny(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function countMatches(text: string, pattern: RegExp): number {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  return [...text.matchAll(new RegExp(pattern.source, flags))].length;
}

export function validateCalibratedUncertainty(output: SolenOSResponse): CalibratedUncertaintyResult {
  const text = collectCaregiverText(output);
  const violations = new Set<CalibratedUncertaintyViolationCode>();

  if (matchAny(text, GUARANTEE_LANGUAGE_PATTERNS)) {
    violations.add("guarantee_language");
  }

  if (matchAny(text, OUTCOME_REASSURANCE_PATTERNS)) {
    violations.add("outcome_reassurance");
  }

  if (matchAny(text, RESOLVED_UNCERTAINTY_PATTERNS)) {
    violations.add("resolved_uncertainty_implied");
  }

  if (output.risk_level === "low" && matchAny(text, LOW_RISK_FALSE_SAFETY_PATTERNS)) {
    violations.add("low_risk_read_as_safe");
  }

  if (matchAny(text, PANIC_AMPLIFICATION_PATTERNS)) {
    violations.add("panic_amplification");
  }

  const incomplete = outputImpliesIncompleteContext(output);

  if (incomplete && !ESCALATION_PATHWAY_MARKERS.test(text) && !hasClarifyingQuestion(output)) {
    violations.add("escalation_pathway_missing");
  }

  const paralysisHits = PARALYSIS_PATTERNS.reduce(
    (sum, pattern) => sum + countMatches(text, pattern),
    0,
  );
  const fieldsStartWithParalysis =
    PARALYSIS_PATTERNS.some((p) => p.test(output.what_is_happening.trim())) &&
    PARALYSIS_PATTERNS.some((p) => p.test(output.what_matters_now.trim()));

  if (paralysisHits >= 3 || fieldsStartWithParalysis) {
    violations.add("interpretive_paralysis");
  }

  const matters = output.what_matters_now;
  if (
    matters.length < MIN_USEFUL_PRIORITIZATION_LENGTH &&
    !PRIORITIZATION_MARKERS.test(matters)
  ) {
    violations.add("missing_prioritization");
  }

  if (
    output.what_is_happening.length < 30 &&
    output.what_matters_now.length < 30 &&
    paralysisHits >= 2
  ) {
    violations.add("interpretive_paralysis");
  }

  return { valid: violations.size === 0, violations: [...violations] };
}

export function isCalibratedUncertaintyValid(output: SolenOSResponse): boolean {
  return validateCalibratedUncertainty(output).valid;
}
