/**
 * Living Care Record UX — caregiver-facing response contract.
 * The Living Care Record is the product. AI is an internal capability.
 */

export const LIVING_CARE_RECORD_UX_IDENTITY =
  "SolenOS is a Living Care Record — not an AI chatbot. The AI stays almost invisible.";

export const LIVING_CARE_RECORD_UX_GOAL =
  "SolenOS understood what happened and knows what it still needs.";

export const LIVING_CARE_RECORD_UX_NEVER =
  "The AI is showing me how it thinks.";

/** Default caregiver response — only these four sections. */
export const LIVING_CARE_RECORD_DEFAULT_SECTIONS = [
  "care_event_added",
  "what_understood",
  "what_needs_context",
  "what_will_be_remembered",
] as const;

/** Progressive disclosure — optional, collapsed by default. */
export const LIVING_CARE_RECORD_EXPANDABLE = [
  "evidence",
  "timeline",
  "related_events",
  "patterns",
  "previous_similar",
  "confidence_detail",
] as const;

/** Forbidden in caregiver UI — logs/developer tools only. */
export const LIVING_CARE_RECORD_FORBIDDEN_UI_TERMS = [
  "ambiguous_extraction",
  "partial_signal",
  "partial signal",
  "edge_state",
  "structural_risk",
  "reasoning_chain",
  "system_layers",
  "condensed_triage",
  "inference_pipeline",
  "extraction_status",
  "parser_output",
  "observation signal",
  "crisis mode",
] as const;

export const HUMAN_CONFIDENCE_LABELS = [
  "Limited information available",
  "Needs confirmation",
] as const;

export const LIVING_CARE_RECORD_RESPONSE_GATE = [
  "reassure_information_preserved",
  "strengthen_living_care_record",
  "reduce_cognitive_burden",
  "clarifications_specific_and_relevant",
  "no_internal_ai_implementation_details",
  "present_understanding_not_ai_reasoning",
  "calm_and_trustworthy_under_stress",
] as const;
