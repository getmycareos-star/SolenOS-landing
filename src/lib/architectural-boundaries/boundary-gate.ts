import {
  ARCHITECTURAL_RULES,
  DECISION_FRAMEWORK_QUESTIONS,
} from "./contract-constants";
import type { ArchitecturalRule, BoundaryGateInput, BoundaryGateResult } from "./types";

export function evaluateAgainstDecisionFramework(
  input: BoundaryGateInput,
): BoundaryGateResult {
  const failed: string[] = [];
  const violated: ArchitecturalRule[] = [];

  if (!input.preserves_truth) failed.push(DECISION_FRAMEWORK_QUESTIONS[0]!);
  if (!input.reduces_uncertainty_without_concealing) failed.push(DECISION_FRAMEWORK_QUESTIONS[1]!);
  if (!input.strengthens_continuity) failed.push(DECISION_FRAMEWORK_QUESTIONS[2]!);
  if (!input.explainable) failed.push(DECISION_FRAMEWORK_QUESTIONS[3]!);
  if (!input.confidence_proportional) failed.push(DECISION_FRAMEWORK_QUESTIONS[4]!);
  if (!input.reduces_burden_without_clinical_replacement) {
    failed.push(DECISION_FRAMEWORK_QUESTIONS[5]!);
  }

  if (input.may_diagnose) violated.push("never_diagnose");
  if (input.may_invent_facts) violated.push("never_invent_information");
  if (input.may_hide_uncertainty) violated.push("never_hide_uncertainty");
  if (input.may_overwrite_history) violated.push("never_overwrite_history");
  if (input.optimizes_engagement) violated.push("never_optimize_for_engagement");

  const passes = failed.length === 0 && violated.length === 0;

  let recommendation: BoundaryGateResult["recommendation"] = "build";
  if (!passes) {
    recommendation =
      violated.length > 0 || input.may_diagnose ? "reject" : "redesign";
  }

  return {
    passes,
    framework_questions: DECISION_FRAMEWORK_QUESTIONS,
    failed_questions: failed,
    violated_rules: violated,
    recommendation,
  };
}

export { ARCHITECTURAL_RULES, DECISION_FRAMEWORK_QUESTIONS };
