import type {
  NORTH_STAR_IMPLICIT_OUTPUT_QUESTIONS,
  PRODUCT_NORTH_STAR_RULES,
} from "./contract-constants";
import type { ContinuityFailureTheme } from "./demand-model";

export type NorthStarVerdict = "pass" | "reject" | "unclear_rejected";

export type FeatureNorthStarEvaluation = {
  feature_description: string;
  verdict: NorthStarVerdict;
  reduces_memory_reconstruction: boolean | null;
  reason: string;
  north_star_test: string;
};

export type DemandClassification = {
  demand_type: "continuity_demand" | "search_demand" | "unknown";
  matched_themes: ContinuityFailureTheme[];
  underlying_needs: string[];
  build_engines_not_answers: string[];
  treat_as_product_signal: boolean;
};

export type ImplicitOutputCoverage = Record<
  (typeof NORTH_STAR_IMPLICIT_OUTPUT_QUESTIONS)[number],
  boolean
>;

export type ProductNorthStarResult = {
  active: boolean;
  north_star: string;
  feature_gate_passed: boolean;
  demand: DemandClassification | null;
  implicit_output_coverage: ImplicitOutputCoverage;
  output_answers_memory_questions: boolean;
  anti_answer_engine: true;
  /** True when Search Demand was refused and redirected to continuity capture. */
  refused_generic_search_answer: boolean;
  success_criteria_message: string;
  rules_upheld: readonly (typeof PRODUCT_NORTH_STAR_RULES)[number][];
  defining_principle: string;
};

export type ProcessProductNorthStarInput = {
  raw_input?: string;
  final_what_is_happening?: string;
  final_what_matters_now?: string;
  final_what_can_wait?: string;
  what_changed?: string[];
  has_care_events?: boolean;
  has_meaningful_diff?: boolean;
  has_state_of_care?: boolean;
  /** Optional: evaluate a proposed feature against the North Star */
  proposed_feature?: string;
};
