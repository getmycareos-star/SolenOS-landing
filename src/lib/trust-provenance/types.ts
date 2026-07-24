import type {
  EVIDENCE_KINDS,
  PROVENANCE_SOURCE_TYPES,
  RESPONSE_CONFIDENCE_LEVELS,
  RETRIEVAL_PIPELINE_STEPS,
  TRUST_INDICATOR_KINDS,
} from "./contract-constants";
import type { TruthSource } from "../care-event-integrity/types";
import type { VerificationStatus } from "../failure-resilience/types";

export type ResponseConfidenceLevel = (typeof RESPONSE_CONFIDENCE_LEVELS)[number];
export type TrustIndicatorKind = (typeof TRUST_INDICATOR_KINDS)[number];
export type ProvenanceSourceType = (typeof PROVENANCE_SOURCE_TYPES)[number];
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];
export type RetrievalPipelineStep = (typeof RETRIEVAL_PIPELINE_STEPS)[number];

export type ProvenanceRecord = {
  fact_id: string;
  fact_label: string;
  source_label: string;
  source_type: ProvenanceSourceType;
  extracted_from: string | null;
  captured_at: string;
  confidence: "low" | "medium" | "high";
  verification_status: VerificationStatus;
  truth_sources: TruthSource[];
  raw_input_id: string | null;
  event_id: string | null;
  document_id: string | null;
};

export type TrustIndicator = {
  id: string;
  kind: TrustIndicatorKind;
  label: string;
  event_id: string | null;
  fact_id: string | null;
};

export type AuditTrailSummary = {
  event_id: string;
  field_label: string;
  original_value: string | null;
  updated_value: string | null;
  changed_by: string;
  changed_at: string;
  reason: string | null;
};

export type EvidenceItem = {
  kind: EvidenceKind;
  id: string;
  label: string;
  captured_at: string | null;
  confidence: string | null;
  source_type: string | null;
};

export type EvidenceBundle = {
  insight_id: string;
  insight_label: string;
  supporting_events: EvidenceItem[];
  related_documents: EvidenceItem[];
  user_corrections: EvidenceItem[];
  timeline_references: EvidenceItem[];
  unresolved_uncertainties: EvidenceItem[];
};

export type ReasoningStep = {
  step: number;
  description: string;
  evidence_ids: string[];
};

export type ReasoningChain = {
  question: string | null;
  steps: ReasoningStep[];
  conclusion: string;
  evidence_event_ids: string[];
  generated_from: "validated_care_events";
};

export type RetrievalContextSnapshot = {
  pipeline_steps: RetrievalPipelineStep[];
  care_event_ids: string[];
  document_ids: string[];
  correction_ids: string[];
  unresolved_uncertainties: string[];
  sufficient_for_answer: boolean;
};

export type GenerationBoundaries = {
  allowed: readonly string[];
  forbidden: readonly string[];
  retrieval_only: true;
};

export type ResponseConfidenceAssessment = {
  level: ResponseConfidenceLevel;
  reason: string;
  evidence_count: number;
  verified_count: number;
  unresolved_count: number;
};

export type TrustProvenanceResult = {
  provenance_records: ProvenanceRecord[];
  trust_indicators: TrustIndicator[];
  audit_trail_summary: AuditTrailSummary[];
  evidence_bundles: EvidenceBundle[];
  reasoning_chains: ReasoningChain[];
  confidence_assessment: ResponseConfidenceAssessment;
  retrieval_context: RetrievalContextSnapshot;
  generation_boundaries: GenerationBoundaries;
  insufficient_evidence_message: string;
};
