import type {
  FAILURE_CATEGORIES,
  FAILURE_OUTCOMES,
  PROCESSING_STATUSES,
  RELATIONSHIP_STATUSES,
  VERIFICATION_STATUSES,
} from "./contract-constants";

export type FailureCategory = (typeof FAILURE_CATEGORIES)[number];
export type FailureOutcome = (typeof FAILURE_OUTCOMES)[number];
export type ProcessingStatus = (typeof PROCESSING_STATUSES)[number];
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];
export type RelationshipStatus = (typeof RELATIONSHIP_STATUSES)[number];

export type ExtractionConfidence = {
  object_id: string;
  object_type: "event" | "candidate" | "raw_input";
  confidence_score: number;
  confidence_level: "low" | "medium" | "high";
  uncertainty_reason: string;
  known_facts: string[];
  unknown_facts: string[];
  missing_information: string[];
  verification_status: VerificationStatus;
  needs_confirmation_before_linking: boolean;
};

export type FailureRecord = {
  id: string;
  category: FailureCategory;
  outcome: FailureOutcome;
  message: string;
  raw_input_id: string | null;
  event_id: string | null;
  extracted_partial: string[];
  not_understood: string[];
  clarification_questions: string[];
  possible_interpretations: string[];
  relationship_status: RelationshipStatus | null;
  conflict_id: string | null;
  recoverable: boolean;
  created_at: string;
};

export type PendingProcessing = {
  id: string;
  caregiver_id: string;
  raw_input_id: string;
  content_preview: string;
  failure_category: FailureCategory;
  status: ProcessingStatus;
  retry_count: number;
  max_retries: number;
  next_retry_at: string | null;
  error_message: string | null;
  preserved_at: string;
};

export type FailureResilienceResult = {
  failures: FailureRecord[];
  confidence_summaries: ExtractionConfidence[];
  pending_processing: PendingProcessing[];
  outcomes_applied: Record<FailureOutcome, number>;
  processing_status: ProcessingStatus;
  recovery_actions: string[];
  continuity_preserved: boolean;
};
