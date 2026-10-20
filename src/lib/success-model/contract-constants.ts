/** Success model — outcome metrics over activity metrics. */

export const SUCCESS_MODEL_IDENTITY =
  "SolenOS succeeds when caregivers no longer carry the entire care journey in their heads.";

export const ACTIVITY_METRICS = [
  "ai_conversations",
  "documents_uploaded",
  "events_stored",
  "graph_size",
  "time_in_app",
] as const;

export const PRIMARY_SUCCESS_METRICS = [
  "cognitive_load_reduction",
  "continuity_restoration",
  "meeting_preparation_efficiency",
  "follow_up_reliability",
  "recall_accuracy",
] as const;

export const SYSTEM_QUALITY_METRICS = [
  "extraction_confidence",
  "unresolved_uncertainty_count",
  "user_corrections",
  "duplicate_event_rate",
  "event_linking_accuracy",
  "document_processing_accuracy",
  "follow_up_completion_rate",
] as const;

export const USER_TRUST_METRICS = [
  "corrections_accepted",
  "confidence_in_extraction",
  "provenance_coverage",
  "evidence_supported_answers",
  "fabricated_events",
] as const;

export const LONGITUDINAL_METRICS = [
  "connected_events",
  "resolved_uncertainties",
  "linked_relationships",
  "reusable_historical_context",
  "repeated_entry_reduction",
] as const;

export const FEATURE_ACCEPTANCE_QUESTIONS = [
  "Does it reduce mental and cognitive overload?",
  "Does it preserve or restore continuity?",
  "Does it reduce reliance on memory?",
  "Does it improve understanding of what has changed?",
  "Does it help prevent missed context or follow-ups?",
  "Is its value measurable using success metrics?",
] as const;

export const MIN_FEATURE_ACCEPTANCE_YES = 4;
