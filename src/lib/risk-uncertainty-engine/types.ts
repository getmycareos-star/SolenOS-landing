import {
  COMPLETENESS_STATUSES,
  CONFIDENCE_LEVELS,
  PRIORITY_ASSESSMENTS,
} from "./contract-constants";

export { COMPLETENESS_STATUSES, CONFIDENCE_LEVELS, PRIORITY_ASSESSMENTS };

export type CompletenessStatus = (typeof COMPLETENESS_STATUSES)[number];
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];
export type PriorityAssessment = (typeof PRIORITY_ASSESSMENTS)[number];

export type SafetyDomain =
  | "fall_injury"
  | "pain"
  | "breathing"
  | "confusion_behavior"
  | "medication"
  | "eating_drinking"
  | "swelling"
  | "ambiguous_concern";

export type RequiredSignal = {
  id: string;
  label: string;
  pattern: RegExp;
};

export type DomainTrigger = {
  domain: SafetyDomain;
  triggerPattern: RegExp;
  requiredSignals: RequiredSignal[];
};

export type ExtractedFacts = {
  explicit_statements: string[];
  raw_input: string;
};

export type CompletenessResult = {
  status: CompletenessStatus;
  triggered_domains: SafetyDomain[];
  present_signals: string[];
  missing_signals: string[];
};

export type DecisionGateResult = {
  blocked: boolean;
  reason: string | null;
};

export type RiskUncertaintyOutput = {
  situation_summary: string;
  information_completeness: CompletenessStatus;
  confidence_level: ConfidenceLevel;
  priority_assessment: PriorityAssessment;
  missing_information: string[];
  clarifying_questions: string[];
  continuity_record: string;
  decision_gate_blocked: boolean;
  triggered_domains: SafetyDomain[];
};

export type RiskUncertaintyLayerPayload = {
  identity: string;
  boundary: string;
  output: RiskUncertaintyOutput;
  pipeline_step: "blocked_at_gate" | "classified" | "passed_through";
};

export type ProcessRiskUncertaintyResult = {
  output: RiskUncertaintyOutput;
  blocked: boolean;
  solenOSOverride?: boolean;
};
