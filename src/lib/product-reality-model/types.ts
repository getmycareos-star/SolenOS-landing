import type {
  CORRECT_MODEL_RULES,
  FAILURE_MODES,
  OPERATING_ASSUMPTIONS,
  REALITY_MODEL_RULES,
  WRONG_MODEL_PROHIBITIONS,
} from "./contract-constants";

export type ProductRealityModelResult = {
  active: boolean;
  assumptions_upheld: readonly (typeof OPERATING_ASSUMPTIONS)[number][];
  correct_model_rules: readonly (typeof CORRECT_MODEL_RULES)[number][];
  wrong_model_avoided: readonly (typeof WRONG_MODEL_PROHIBITIONS)[number][];
  failure_modes_detected: (typeof FAILURE_MODES)[number][];
  contradiction_count: number;
  incomplete_fields_count: number;
  event_driven: boolean;
  rules_upheld: readonly (typeof REALITY_MODEL_RULES)[number][];
  defining_principle: string;
};

export type ProcessProductRealityModelInput = {
  has_contradictions: boolean;
  contradiction_count: number;
  has_uncertainty: boolean;
  uncertainty_count: number;
  events_appended: number;
  state_derived: boolean;
  manual_state_edit: boolean;
};
