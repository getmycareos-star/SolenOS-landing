import type {
  AMBIGUITY_FLAGS,
  COMPLETENESS_LEVELS,
  CONFIDENCE_SOURCES,
  CORRECTION_TYPES,
  EXTRACTION_METHODS,
} from "./contract-constants";

export type ConfidenceSource = (typeof CONFIDENCE_SOURCES)[number];
export type AmbiguityFlag = (typeof AMBIGUITY_FLAGS)[number];
export type CorrectionType = (typeof CORRECTION_TYPES)[number];
export type ExtractionMethod = (typeof EXTRACTION_METHODS)[number];
export type CompletenessLevel = (typeof COMPLETENESS_LEVELS)[number];

export type RawInputType = "text" | "ocr_text" | "pdf" | "image" | "voice_transcript";

/** Step 1 — never process directly into graph. */
export type RawInput = {
  id: string;
  caregiver_id: string;
  input_type: RawInputType;
  content: string;
  ocr_confidence: number | null;
  document_id: string | null;
  document_name: string | null;
  captured_at: string;
  metadata: Record<string, unknown>;
};

export type ExtractionCandidate = {
  id: string;
  raw_input_id: string;
  extracted_fact: string;
  event_signal: string;
  confidence: number;
  confidence_sources: ConfidenceSource[];
  source_span: string;
  extraction_method: ExtractionMethod;
  ambiguity_flags: AmbiguityFlag[];
  completeness: CompletenessLevel;
  missing_fields: string[];
  created_at: string;
};

export type UncertainEventCandidate = {
  id: string;
  raw_input_id: string;
  label: string;
  event_signal: string;
  reason: string;
  ambiguity: AmbiguityFlag[];
  missing_fields: string[];
  needs_user_review: boolean;
  candidate_ids: string[];
  created_at: string;
};

export type DocumentUnreadableSection = {
  type: "document_unreadable_section";
  raw_input_id: string;
  document_id: string | null;
  reason: "low_ocr_confidence" | "extraction_failed" | "empty_content";
  needs_user_review: true;
  ocr_confidence: number | null;
};

export type DisambiguationQuestion = {
  question_id: string;
  question_type: "disambiguation";
  priority: "high" | "medium" | "low";
  question: string;
  related_candidate_ids: string[];
  ambiguity_flags: AmbiguityFlag[];
};

export type ConflictingClaim = {
  source_raw_input_id: string;
  source_document_id: string | null;
  claim: string;
  date_reference: string | null;
  confidence: number;
};

export type ConflictingEventSet = {
  id: string;
  event_signal: string;
  claims: ConflictingClaim[];
  unresolved: true;
  created_at: string;
};

export type CorrectionEvent = {
  id: string;
  caregiver_id: string;
  target_event_id: string | null;
  target_candidate_id: string | null;
  correction_type: CorrectionType;
  corrected_fields: Record<string, unknown>;
  user_source: string;
  created_at: string;
};

export type ValidatedCareEvent = {
  id: string;
  raw_input_id: string;
  candidate_id: string;
  extracted_fact: string;
  event_signal: string;
  confidence_score: number;
  confidence_sources: ConfidenceSource[];
  validated_at: string;
  validation_method: "auto_threshold" | "user_confirmation" | "correction";
  entities: { kind: string; label: string }[];
  attributes: Record<string, unknown>;
  document_id: string | null;
};

export type DareIngestResult = {
  raw_input: RawInput;
  candidates: ExtractionCandidate[];
  uncertain_events: UncertainEventCandidate[];
  unreadable_sections: DocumentUnreadableSection[];
  disambiguation_questions: DisambiguationQuestion[];
  conflicts: ConflictingEventSet[];
  validated_events: ValidatedCareEvent[];
  provisional_count: number;
  normalization: import("../event-normalization/types").NormalizationResult | null;
};

export type ApplyCorrectionInput = {
  caregiver_id: string;
  target_event_id?: string | null;
  target_candidate_id?: string | null;
  correction_type: CorrectionType;
  corrected_fields: Record<string, unknown>;
  user_source?: string;
};

export type DareProjection = {
  validated_events: ValidatedCareEvent[];
  uncertain_events: UncertainEventCandidate[];
  pending_questions: DisambiguationQuestion[];
  unresolved_conflicts: ConflictingEventSet[];
  corrections: CorrectionEvent[];
};
