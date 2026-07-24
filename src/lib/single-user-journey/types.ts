import type { JOURNEY_RULES, JOURNEY_STEPS } from "./contract-constants";

export type JourneyStep = (typeof JOURNEY_STEPS)[number];

export type JourneyStepRecord = {
  step: JourneyStep;
  completed: boolean;
  detail: string;
};

export type SingleUserJourneyResult = {
  active: boolean;
  interaction_index: number;
  steps_completed: JourneyStepRecord[];
  continuity_proven: boolean;
  care_context_persistent: boolean;
  care_events_created_total: number;
  has_state_output: boolean;
  has_diff_output: boolean;
  chat_behavior_blocked: boolean;
  failure_reasons: string[];
  journey_valid: boolean;
  rules_upheld: readonly (typeof JOURNEY_RULES)[number][];
  defining_principle: string;
};

export type ProcessSingleUserJourneyInput = {
  caregiver_id: string;
  interaction_index: number;
  raw_input: string;
  events_created_count: number;
  total_event_count: number;
  care_context_exists: boolean;
  has_state_of_care: boolean;
  has_meaningful_diff: boolean;
  dominant_mode: string;
  final_what_is_happening: string;
  what_changed: string[];
  is_session_reentry: boolean;
};
