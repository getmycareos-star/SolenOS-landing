/** Data Acquisition + Failure Resilience Engine (DARE) */

export const DARE_IDENTITY =
  "Probabilistic ingestion where every extracted fact is provisional until validated.";

export const DARE_CORE_RULE =
  "The graph is NOT built from extraction. The graph is built from resolved truth.";

export const OCR_CONFIDENCE_THRESHOLD = 0.4;
export const AUTO_VALIDATE_CONFIDENCE = 0.65;

export const CONFIDENCE_SOURCES = [
  "ocr",
  "nlp_model",
  "user_confirmation",
  "cross_document_match",
  "repeated_signal",
] as const;

export const AMBIGUITY_FLAGS = [
  "who_is_he",
  "who_is_they",
  "what_changed",
  "when",
  "unclear_reference",
  "ocr_unreadable",
  "contradictory_sources",
  "partial_signal",
  "voice_corruption",
] as const;

export const CORRECTION_TYPES = ["modify", "delete", "merge", "clarify"] as const;

export const EXTRACTION_METHODS = [
  "regex_nlp",
  "ocr",
  "voice_transcript",
  "document_parse",
  "user_input",
] as const;

export const COMPLETENESS_LEVELS = ["complete", "partial", "insufficient"] as const;
