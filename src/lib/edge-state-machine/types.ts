import type { EDGE_STATES, EDGE_STATE_RULES } from "./contract-constants";

export type EdgeState = (typeof EDGE_STATES)[number];

export type EngineActivation = {
  care_event_engine: boolean;
  timeline_engine: boolean;
  contradiction_engine: boolean;
  diff_engine: boolean;
  prioritization_engine: boolean;
  trust_layer: boolean;
  pattern_engine: boolean;
  continuity_decay_engine: boolean;
};

export type OutputRestrictions = {
  max_insights: number;
  max_actions: number;
  max_clarification_questions: number;
  allow_strong_conclusions: boolean;
  allow_historical_claims: boolean;
  must_label_uncertainty: boolean;
  require_conflict_surface: boolean;
  action_first: boolean;
};

export type EdgeStateResult = {
  active: boolean;
  edge_state: EdgeState;
  classification_reason: string;
  engine_activation: EngineActivation;
  output_restrictions: OutputRestrictions;
  banner_message: string | null;
  rules_upheld: readonly (typeof EDGE_STATE_RULES)[number][];
  defining_principle: string;
};

export type ProcessEdgeStateInput = {
  crisis_detected: boolean;
  unresolved_contradictions: number;
  event_count: number;
  days_since_last_event: number | null;
  continuity_decay_pct: number | null;
  missing_critical_fields: number;
  low_confidence_aggregate: boolean;
};
