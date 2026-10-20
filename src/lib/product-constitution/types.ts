import type {
  CARE_RECORD_SPINE,
  CONSTITUTION_RULES,
  MVP_PRIORITY_ORDER,
  PRODUCT_MOMENTS,
} from "./contract-constants";

export type CareRecordSpineKey = (typeof CARE_RECORD_SPINE)[number];

export type ConstitutionVerdict = "pass" | "reject" | "unclear_rejected";

export type FeatureConstitutionEvaluation = {
  feature_description: string;
  verdict: ConstitutionVerdict;
  reduces_uncertainty: boolean | null;
  improves_care_state_understanding: boolean | null;
  reason: string;
  filters_failed: string[];
};

export type ConfidenceScoreEntry = {
  area: string;
  level: "high" | "medium" | "low";
  note: string;
};

/** First technical artifact: Living Care Record internal spine (not UI). */
export type CareRecordModel = {
  care_recipient_id: string;
  computed_at: string;
  person_profile: string[];
  events: string[];
  observations: string[];
  medications: string[];
  decisions: string[];
  /** What was tried and what happened afterward — decision memory spine. */
  outcomes: string[];
  tasks: string[];
  risks: string[];
  unknowns: string[];
  confidence_scores: ConfidenceScoreEntry[];
};

export type UnderstandingLevel = "good" | "needs_attention" | "limited_information";

/** Daily Care Confidence — conceptual projection (UI later). */
export type DailyCareConfidenceModel = {
  understanding_level: UnderstandingLevel;
  recent_changes: string[];
  things_to_know: string[];
  potential_concerns: string[];
  nothing_urgent: string[];
  information_gaps: string[];
  ten_minute_priorities: string[];
};

export type ProductConstitutionResult = {
  active: boolean;
  worldview: string;
  mission: string;
  category: string;
  ultimate_metric: string;
  primary_feeling: string;
  brand_promise: string;
  tagline: string;
  motto: string;
  care_record: CareRecordModel;
  daily_care_confidence: DailyCareConfidenceModel;
  mvp_priority: readonly (typeof MVP_PRIORITY_ORDER)[number][];
  moments_supported: readonly (typeof PRODUCT_MOMENTS)[number][];
  feature_gate_passed: boolean;
  documents_are_inputs_only: true;
  start_with_state_not_ui: true;
  memory_is_not_diagnosis: true;
  rules_upheld: readonly (typeof CONSTITUTION_RULES)[number][];
  defining_principle: string;
};

export type ProcessProductConstitutionInput = {
  care_recipient_id: string;
  all_events: import("../situation-entry/types").CanonicalCareEvent[];
  events_created: import("../situation-entry/types").CanonicalCareEvent[];
  what_is_uncertain: string[];
  what_needs_clarification: string[];
  care_state?: import("../care-state-engine/types").CareStateSnapshot;
  care_context_diff?: import("../care-context-diff-engine/types").CareContextDiffResult;
  state_of_care?: import("../state-of-care-summary-engine/types").StateOfCareSummaryResult;
  /** Display name for person_profile spine — never invent from notes. */
  subject_label?: string | null;
  final_what_matters_now?: string;
  final_what_can_wait?: string;
  what_changed?: string[];
  proposed_feature?: string;
  as_of?: string;
};
