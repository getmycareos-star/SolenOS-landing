import type { SolenOSResponse } from "../response-validator";
import { collectCaregiverText } from "../solenos-fields";
import {
  DECISION_SURFACE_PATTERNS,
  EDUCATION_DEPTH_PATTERNS,
  EMOTIONAL_FRAMING_IN_STRUCTURE_PATTERNS,
  INTERPRETATION_EXPANSION_PATTERNS,
  MULTI_STEP_STRATEGY_PATTERNS,
  OPTIMIZATION_PATTERNS,
  PLANNING_SYSTEM_PATTERNS,
  WORKFLOW_PATTERNS,
  SELF_BLAME_PATTERNS,
  CAREGIVER_PRESSURE_REDUCTION_VIOLATION_CODES,
  type CaregiverPressureReductionResult,
  type CaregiverPressureReductionViolationCode,
} from "./constants";

function matchAny(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

/** Pressure reduction gate — output must reduce load, not add mental steps. */
export function validateCaregiverPressureReduction(
  output: SolenOSResponse,
): CaregiverPressureReductionResult {
  const text = collectCaregiverText(output);
  const violations = new Set<CaregiverPressureReductionViolationCode>();

  if (matchAny(text, PLANNING_SYSTEM_PATTERNS)) {
    violations.add("planning_system_language");
  }
  if (matchAny(text, WORKFLOW_PATTERNS)) {
    violations.add("workflow_creation");
  }
  if (matchAny(text, MULTI_STEP_STRATEGY_PATTERNS)) {
    violations.add("multi_step_strategy");
  }
  if (matchAny(output.what_is_happening, INTERPRETATION_EXPANSION_PATTERNS)) {
    violations.add("interpretation_expansion");
  }
  if (matchAny(text, SELF_BLAME_PATTERNS)) {
    violations.add("self_blame_amplification");
  }
  if (matchAny(text, EDUCATION_DEPTH_PATTERNS)) {
    violations.add("education_depth");
  }
  if (matchAny(text, OPTIMIZATION_PATTERNS)) {
    violations.add("optimization_language");
  }
  if (matchAny(text, EMOTIONAL_FRAMING_IN_STRUCTURE_PATTERNS)) {
    violations.add("emotional_framing_in_structure");
  }
  if (matchAny(text, DECISION_SURFACE_PATTERNS)) {
    violations.add("decision_surface_expansion");
  }

  return { valid: violations.size === 0, violations: [...violations] };
}

export function isCaregiverPressureReductionValid(output: SolenOSResponse): boolean {
  return validateCaregiverPressureReduction(output).valid;
}

/** @deprecated Use validateCaregiverPressureReduction */
export const validatePressureReduction = validateCaregiverPressureReduction;

/** @deprecated Use isCaregiverPressureReductionValid */
export const isPressureReductionValid = isCaregiverPressureReductionValid;

export { CAREGIVER_PRESSURE_REDUCTION_VIOLATION_CODES };
