export type ConfidenceTag = "confirmed" | "reported" | "inferred" | "unknown" | "contradictory";

export type EntityType = "person" | "place" | "institution" | "object" | "symptom" | "behavior" | "medication" | "event" | "unknown";

export type SourceSpan = {
  start_offset: number;
  end_offset: number;
  text: string;
};

export type ExtractedClaim = {
  id: string;
  claim_text: string;
  entity_type: EntityType;
  event_type: string;
  confidence_tag: ConfidenceTag;
  source_span: SourceSpan | null;
  raw_input_id: string;
  evidence_id: string;
  extraction_run_id: string;
  created_at: string;
};

export type ValidatedClaim = ExtractedClaim & {
  pointer_valid: boolean;
  pointer_enforced_tag: ConfidenceTag;
};

export type ReconciliationResult = {
  evidence_id: string;
  reconciled_claims: ExtractedClaim[];
  matched_pairs: MatchedPair[];
  a_only_claims: ExtractedClaim[];
  b_only_claims: ExtractedClaim[];
  disagreements: DisagreementLog[];
  a_only_logs: AOnlyLog[];
  b_only_logs: AOnlyLog[];
  metrics: ReconciliationMetrics;
};

export type MatchedPair = {
  claim_a: ExtractedClaim;
  claim_b: ExtractedClaim;
  overlap_ratio: number;
  entity_agrees: boolean;
  event_type_agrees: boolean;
  confidence_agrees: boolean;
  final_claim: ExtractedClaim;
};

export type DisagreementLog = {
  evidence_id: string;
  claim_id_a: string;
  claim_id_b: string;
  run_a_confidence: ConfidenceTag;
  run_b_confidence: ConfidenceTag;
  final_confidence: ConfidenceTag;
  entity_a: EntityType;
  entity_b: EntityType;
  event_type_a: string;
  event_type_b: string;
  disagreement_fields: string[];
  source_span_a: SourceSpan | null;
  source_span_b: SourceSpan | null;
  reason: string;
  timestamp: string;
};

export type AOnlyLog = {
  evidence_id: string;
  claim_id: string;
  run: "A" | "B";
  reason: string;
  original_confidence: ConfidenceTag;
  final_confidence: ConfidenceTag;
  timestamp: string;
};

export type ReconciliationMetrics = {
  total_extracted_claims: number;
  matched_claims: number;
  a_only_claims: number;
  b_only_claims: number;
  full_agreement_claims: number;
  disagreement_claims: number;
  confirmed_claims: number;
  reported_claims: number;
  inferred_claims: number;
  unknown_claims: number;
  downgrade_count: number;
  confirmed_survival_rate: number;
};

export type ExtractionRunOutput = {
  run_id: string;
  claims: ExtractedClaim[];
  raw_output: string;
  success: boolean;
  error?: string;
};

export type ConsistencyGateInput = {
  evidence_id: string;
  raw_text: string;
  raw_input_id: string;
  caregiver_id: string;
  timestamp?: string;
};

export type ConsistencyGateResult = {
  success: boolean;
  reconciliation: ReconciliationResult;
  run_a: ExtractionRunOutput;
  run_b: ExtractionRunOutput;
  error?: string;
};
