import {
  CORRECT_MODEL_RULES,
  FAILURE_MODES,
  OPERATING_ASSUMPTIONS,
  PRODUCT_REALITY_DEFINING_PRINCIPLE,
  REALITY_MODEL_RULES,
  WRONG_MODEL_PROHIBITIONS,
} from "./contract-constants";
import type { ProcessProductRealityModelInput, ProductRealityModelResult } from "./types";

export function processProductRealityModel(
  input: ProcessProductRealityModelInput,
): ProductRealityModelResult {
  const failure_modes_detected: (typeof FAILURE_MODES)[number][] = [];

  if (input.manual_state_edit) {
    failure_modes_detected.push("deletes_conflicting_data");
  }
  if (input.has_contradictions === false && input.contradiction_count > 0) {
    failure_modes_detected.push("hides_contradictions");
  }
  if (!input.state_derived && input.events_appended > 0) {
    failure_modes_detected.push("assumes_clean_input");
  }

  const correct_model_rules: (typeof CORRECT_MODEL_RULES)[number][] = [
    "event_first_not_form_first",
  ];
  if (input.state_derived) {
    correct_model_rules.push("state_is_derived", "conflict_is_first_class", "missing_data_explicit");
  }

  return {
    active: true,
    assumptions_upheld: [...OPERATING_ASSUMPTIONS],
    correct_model_rules,
    wrong_model_avoided: [...WRONG_MODEL_PROHIBITIONS],
    failure_modes_detected,
    contradiction_count: input.contradiction_count,
    incomplete_fields_count: input.uncertainty_count,
    event_driven: input.events_appended >= 0 && input.state_derived,
    rules_upheld: [...REALITY_MODEL_RULES],
    defining_principle: PRODUCT_REALITY_DEFINING_PRINCIPLE,
  };
}
