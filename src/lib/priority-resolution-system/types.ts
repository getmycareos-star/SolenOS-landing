import type { OUTPUT_MODE_PRIORITY, PRIORITY_RESOLUTION_RULES } from "./contract-constants";

export type OutputMode = (typeof OUTPUT_MODE_PRIORITY)[number];

export type PriorityTriggers = {
  crisis_detected: boolean;
  no_care_context: boolean;
  is_first_interaction: boolean;
  is_session_reentry: boolean;
  is_return_session: boolean;
  has_care_context: boolean;
  clarification_required: boolean;
  insufficient_data_for_inference: boolean;
  /** When true, continuation prefers State of Care / Diff over clarification */
  has_meaningful_change: boolean;
};

export type PriorityResolutionResult = {
  active: boolean;
  dominant_mode: OutputMode;
  suppressed_modes: OutputMode[];
  evaluated_triggers: PriorityTriggers;
  selection_reason: string;
  rules_upheld: readonly (typeof PRIORITY_RESOLUTION_RULES)[number][];
  defining_principle: string;
};

export type ProcessPriorityResolutionInput = PriorityTriggers;
