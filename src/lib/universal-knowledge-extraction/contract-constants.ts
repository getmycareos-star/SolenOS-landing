/** Universal Knowledge Extraction Engine — documents become structured knowledge. */

export const UNIVERSAL_KNOWLEDGE_IDENTITY =
  "Documents are not stored as files — they become structured, evidence-backed knowledge that expands the Care Journey.";

export const UNIVERSAL_KNOWLEDGE_BOUNDARY =
  "The document is the source. The Care Journey is the destination. Never invent facts not supported by document text.";

export const UNIVERSAL_KNOWLEDGE_PIPELINE = [
  "OCR (if needed)",
  "Extract structured knowledge",
  "Identify document type",
  "Classify information",
  "Link to existing Care Journey",
  "Create or update journey events",
  "Detect relationships",
  "Identify follow-ups",
  "Surface important changes",
  "Store original document as evidence",
] as const;

export const KNOWLEDGE_DOMAINS = [
  "medical",
  "legal",
  "financial",
  "administrative",
  "caregiving",
  "personal",
] as const;

export const KNOWLEDGE_CATEGORIES = [
  "event",
  "person",
  "organization",
  "date",
  "location",
  "decision",
  "responsibility",
  "deadline",
  "medication",
  "diagnosis",
  "symptom",
  "behaviour",
  "appointment",
  "financial_obligation",
  "legal_authority",
  "restriction",
  "care_instruction",
  "follow_up_action",
  "risk",
  "outstanding_question",
] as const;

export const CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;

/** Items below this numeric score require human review before permanent journey commit. */
export const HUMAN_REVIEW_THRESHOLD = 0.55;
