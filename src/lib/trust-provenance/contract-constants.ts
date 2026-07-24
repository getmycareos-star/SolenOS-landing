/** Trust & provenance — trust is visible system behavior, not a product promise. */

export const TRUST_PROVENANCE_IDENTITY =
  "SolenOS does not generate truth. It reconstructs continuity from evidence.";

export const INSUFFICIENT_EVIDENCE_MESSAGE =
  "I don't have enough information to answer this confidently.";

export const RESPONSE_CONFIDENCE_LEVELS = [
  "high",
  "medium",
  "low",
  "insufficient",
] as const;

export const TRUST_INDICATOR_KINDS = [
  "verified_by_caregiver",
  "extracted_from_document",
  "confirmed_follow_up",
  "awaiting_confirmation",
  "low_confidence",
  "missing_evidence",
] as const;

export const PROVENANCE_SOURCE_TYPES = [
  "user_input",
  "voice",
  "text",
  "document",
  "ocr_text",
  "pdf",
  "image",
  "correction",
] as const;

export const EVIDENCE_KINDS = [
  "care_event",
  "document",
  "correction",
  "timeline_ref",
  "unresolved_uncertainty",
] as const;

export const RETRIEVAL_PIPELINE_STEPS = [
  "retrieve_care_events",
  "retrieve_linked_documents",
  "retrieve_user_corrections",
  "retrieve_unresolved_uncertainties",
  "generate_from_retrieved_context_only",
] as const;

export const GENERATION_ALLOWED = [
  "organize_information",
  "reconstruct_timelines",
  "explain_relationships",
  "identify_missing_information",
  "highlight_inconsistencies",
  "suggest_clarification_questions",
] as const;

export const GENERATION_FORBIDDEN = [
  "invent_events",
  "invent_dates",
  "invent_relationships",
  "assume_intentions",
  "predict_outcomes_without_evidence",
  "present_speculation_as_fact",
] as const;
