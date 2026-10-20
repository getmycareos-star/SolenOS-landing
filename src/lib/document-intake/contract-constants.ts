/**
 * Universal Document Intake + Structured Clarity Contract constants.
 */
export const CANONICAL_DOCUMENT_SYSTEM_IDENTITY =
  "a deterministic, input-grounded, uncertainty-preserving document transformation engine that converts unstructured human information into structured cognitive clarity";

export const CANONICAL_DOCUMENT_ONE_LINE_TRUTH =
  "SolenOS is a deterministic document-to-clarity transformation engine that restructures complex human information into grounded, uncertainty-preserving cognitive clarity without generating authority, assumptions, or inferred meaning.";

export const CANONICAL_DOCUMENT_PRINCIPLE =
  "All uploaded documents are treated as unstructured human complexity requiring structured clarification under uncertainty.";

/** Section 5 — universal document pipeline (no domain branches). */
export const CANONICAL_DOCUMENT_PIPELINE = [
  "Input normalization",
  "Document type tagging",
  "Structural extraction",
  "Signal prioritization",
  "Uncertainty preservation",
  "Context window stabilization",
  "Structured transformation",
  "Strict validation",
  "Safety filter",
  "UI rendering",
] as const;

/** Section 6 — organizational tags only (NOT interpretation logic). */
export const CANONICAL_DOCUMENT_TYPE_TAGS = [
  "MEDICAL_DOCUMENT",
  "INSURANCE_DOCUMENT",
  "LEGAL_DOCUMENT",
  "FINANCIAL_DOCUMENT",
  "GOVERNMENT_BENEFIT_DOCUMENT",
  "CARE_INSTRUCTION_DOCUMENT",
  "MIXED_UNSTRUCTURED_DOCUMENT",
] as const;

/** Section 8 — extraction priority order. */
export const CANONICAL_EXTRACTION_PRIORITIES = [
  "ACTION_CRITICAL",
  "STRUCTURAL_FACTS",
  "ENTITY_MAPPING",
  "UNCERTAINTY",
  "NARRATIVE_CONTENT",
] as const;

/** Section 9 — canonical document clarity structure (stable globally). */
export const CANONICAL_DOCUMENT_CLARITY_FIELD_ORDER = [
  "document_types",
  "key_facts",
  "action_items",
  "deadlines",
  "entities",
  "uncertainties",
  "risk_flags",
] as const;

export const CANONICAL_FORBIDDEN_DOCUMENT_INTERPRETATION = [
  "interpret legal validity",
  "interpret medical diagnosis",
  "interpret insurance approval meaning",
  "determine eligibility",
  "infer institutional intent",
  "simulate professional expertise",
] as const;
