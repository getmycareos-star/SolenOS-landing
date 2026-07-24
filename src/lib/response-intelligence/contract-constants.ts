/** Response Intelligence contract constants. */

export const RESPONSE_INTELLIGENCE_PURPOSE =
  "Transform unpredictable caregiver input into trustworthy care understanding — meaning over language patterns.";

export const RESPONSE_INTELLIGENCE_PIPELINE = [
  "meaning_understanding",
  "compare_with_living_care_record",
  "identify_changes_relationships_unknowns",
  "generate_care_understanding_output",
] as const;

/** Structured outcome fields — generated from understanding, not a fill-in form. */
export const RESPONSE_OUTPUT_FIELDS = [
  "what_is_happening",
  "what_matters_now",
  "what_to_ask_next",
  "risk_level",
  "what_can_wait",
  "follow_up_items",
] as const;

/** Caregiver-visible AI product / mechanics language — never show. */
export const RESPONSE_AI_PRODUCT_LANGUAGE_BANS = [
  "i analyzed",
  "i extracted",
  "i detected",
  "based on my analysis",
  "according to the uploaded document",
  "care event created",
  "entity identified",
  "confidence score",
  "classification",
  "sentiment detected",
  "sentiment analysis",
  "extraction complete",
  "ocr completed",
  "ocr confidence",
  "parsing complete",
  "as an ai",
  "ai thinks",
  "i recommend",
  "it appears diagnosed",
] as const;

/**
 * Soft / vague caregiver inputs that must still produce useful orientation.
 * Illustrations only — never phrase-specific product rules.
 */
export const RESPONSE_GOLDEN_SOFT_INPUTS = [
  "Things have been strange lately.",
  "She wasn't herself today.",
  "The hospital changed something but I don't remember why.",
  "I found this discharge paper.",
  "I don't know what I am supposed to do.",
] as const;

export const RESPONSE_HARD_FAILURE_CHECKS = [
  "chatbot_conversation",
  "medical_advice",
  "diagnosis_claims",
  "generic_empathy",
  "document_summary_without_meaning",
  "unnecessary_questions",
  "fake_certainty",
  "isolated_event_restart",
  "continuity_loss",
  "ai_product_language",
] as const;
