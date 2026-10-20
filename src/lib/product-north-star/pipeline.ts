import {
  PRODUCT_NORTH_STAR,
  PRODUCT_NORTH_STAR_DEFINING_PRINCIPLE,
  PRODUCT_NORTH_STAR_RULES,
} from "./contract-constants";
import { classifyCaregiverDemand } from "./classify-demand";
import { evaluateFeatureAgainstNorthStar, isNorthStarPass } from "./evaluate-feature";
import type {
  ImplicitOutputCoverage,
  ProcessProductNorthStarInput,
  ProductNorthStarResult,
} from "./types";

function coverImplicitOutputs(input: ProcessProductNorthStarInput): ImplicitOutputCoverage {
  const happening = input.final_what_is_happening ?? "";
  const matters = input.final_what_matters_now ?? "";
  const canWait = input.final_what_can_wait ?? "";
  const changed = input.what_changed ?? [];

  return {
    what_changed:
      changed.length > 0 ||
      input.has_meaningful_diff === true ||
      /\b(changed|wors|new|fell|increased|decreased)\b/i.test(happening),
    what_matters_now: matters.trim().length > 0,
    what_should_i_remember:
      happening.trim().length > 0 || input.has_care_events === true,
    what_can_i_ignore: canWait.trim().length > 0,
  };
}

export function processProductNorthStar(
  input: ProcessProductNorthStarInput,
): ProductNorthStarResult {
  const demand = input.raw_input ? classifyCaregiverDemand(input.raw_input) : null;

  const featureEval = input.proposed_feature
    ? evaluateFeatureAgainstNorthStar(input.proposed_feature)
    : null;

  const implicit_output_coverage = coverImplicitOutputs(input);
  const coveredCount = Object.values(implicit_output_coverage).filter(Boolean).length;
  const output_answers_memory_questions = coveredCount >= 2;

  const feature_gate_passed = featureEval ? isNorthStarPass(featureEval.verdict) : true;
  const refused_generic_search_answer = demand?.demand_type === "search_demand";

  return {
    active: true,
    north_star: PRODUCT_NORTH_STAR,
    feature_gate_passed,
    demand,
    implicit_output_coverage,
    output_answers_memory_questions,
    anti_answer_engine: true,
    refused_generic_search_answer,
    success_criteria_message:
      "Caregivers stop re-explaining history; system surfaces what changed; decisions come from system memory.",
    rules_upheld: [...PRODUCT_NORTH_STAR_RULES],
    defining_principle: PRODUCT_NORTH_STAR_DEFINING_PRINCIPLE,
  };
}
