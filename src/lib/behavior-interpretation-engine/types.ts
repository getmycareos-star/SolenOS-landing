import type {
  BEHAVIOR_PROHIBITED,
  BEHAVIOR_TAXONOMY_GROUPS,
  CONFIDENCE_LEVELS,
  INVESTIGATION_DOMAINS,
  REASONING_PIPELINE_STAGES,
  UNMET_NEED_CANDIDATES,
} from "./contract-constants";
import type { CanonicalCareEvent } from "../situation-entry/types";

export type BehaviorTaxonomyGroup = (typeof BEHAVIOR_TAXONOMY_GROUPS)[number];
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];
export type InvestigationDomain = (typeof INVESTIGATION_DOMAINS)[number];
export type UnmetNeed = (typeof UNMET_NEED_CANDIDATES)[number];
export type ReasoningStage = (typeof REASONING_PIPELINE_STAGES)[number];

export type BehaviorHypothesis = {
  interpretation: string;
  confidence: ConfidenceLevel;
  supporting_event_ids: string[];
  uncertainty_note: string;
};

export type ObservedBehavior = {
  behavior_id: string;
  label: string;
  group: BehaviorTaxonomyGroup;
  source_event_id: string;
  observed_at: string;
  raw_observation: string;
};

export type InvestigationItem = {
  domain: InvestigationDomain;
  item: string;
  checked: false;
};

export type EscalationAssessment = {
  escalation_recommended: boolean;
  triggers: string[];
  suggested_actions: string[];
  risk_elevation: "none" | "medium" | "high";
};

export type BehaviorKnowledgeNode = {
  behavior_id: string;
  label: string;
  interpretations: BehaviorHypothesis[];
  possible_needs: UnmetNeed[];
  investigation_checklist: InvestigationItem[];
  recommended_responses: string[];
  escalation_rules: string[];
  observed_outcome_event_ids: string[];
};

export type LongitudinalPattern = {
  behavior_id: string;
  label: string;
  occurs_after: string[];
  occurs_before: string[];
  occurs_during: string[];
  confidence: ConfidenceLevel;
  observation_count: number;
};

export type BehaviorInterpretationResult = {
  triggered: boolean;
  trigger_reasons: string[];
  observed_behaviors: ObservedBehavior[];
  hypotheses: BehaviorHypothesis[];
  possible_needs: UnmetNeed[];
  investigation_checklist: InvestigationItem[];
  recommended_approach: string[];
  escalation: EscalationAssessment;
  knowledge_nodes: BehaviorKnowledgeNode[];
  longitudinal_patterns: LongitudinalPattern[];
  behavioral_change_detected: boolean;
  contributing_event_ids: string[];
  reasoning_stages_completed: ReasoningStage[];
  prohibited_avoided: (typeof BEHAVIOR_PROHIBITED)[number][];
  decision_trace_events: string[];
  decision_trace_assumptions: string[];
  decision_trace_unknowns: string[];
};

export type ProcessBehaviorInterpretationInput = {
  caregiver_id: string;
  events_created: CanonicalCareEvent[];
  all_events: CanonicalCareEvent[];
  prior_events: CanonicalCareEvent[];
  what_changed: string[];
  /** Observable snippets already attached to CareEvents — not raw pipeline text processing. */
  situation_snippets?: string[];
};

export type { CanonicalCareEvent };
