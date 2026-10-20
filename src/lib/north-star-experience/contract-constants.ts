/**
 * North Star Experience — product philosophy every technical decision optimizes toward.
 * If architecture is the brain, this is the purpose.
 */

export const NORTH_STAR_EXPERIENCE_IDENTITY =
  "solenos is successful because caregivers feel they are continuing an ongoing relationship with a system that remembers, understands, and evolves with their care journey.";

/** The single defining success criterion — how solenos must feel. */
export const NORTH_STAR_FEELING =
  "A caregiver should never need to reconstruct the care journey from memory.";

export const NORTH_STAR_OPTIMIZING_FOR =
  "Externalizing care-journey memory so caregivers only react to surfaced reality — not reconstructing history." as const;

/** Not optimization targets — override engagement-driven product decisions. */
export const NORTH_STAR_NOT_OPTIMIZING = [
  "longer conversations",
  "more AI responses",
  "more features",
  "more screen time",
  "more engagement",
  "engagement metrics",
  "addiction patterns",
  "unnecessary notifications",
  "gamification",
] as const;

export const EMOTIONAL_OUTCOMES = [
  "understood",
  "oriented",
  "less overwhelmed",
  "confident about what matters now",
  "confident context has not been forgotten",
] as const;

export const PRODUCT_PRINCIPLES = [
  "continuity",
  "understanding_before_responding",
  "preserve_context",
  "reduce_cognitive_load",
  "explain_thinking",
] as const;

export const PRINCIPLE_DEFINITIONS: Record<(typeof PRODUCT_PRINCIPLES)[number], string> = {
  continuity:
    "The system remembers previous situations and naturally continues the care journey — the caregiver rarely repeats information.",
  understanding_before_responding:
    "solenos understands the situation before offering guidance — no rushed recommendations without context.",
  preserve_context:
    "Every interaction strengthens CareContext — nothing meaningful disappears between sessions.",
  reduce_cognitive_load:
    "The caregiver leaves with fewer things to remember — solenos becomes external memory.",
  explain_thinking:
    "Recommendations explain what changed, why it matters, confidence level, and what remains uncertain.",
};

export const EXPERIENCE_TEST_QUESTION =
  "Does this make the caregiver feel that solenos already understands their situation?";

export const EXPERIENCE_ANTI_PATTERNS = [
  "caregiver repeatedly enters the same background information",
  "previous context is ignored",
  "recommendations disconnected from historical events",
  "every session feels independent",
  "AI behaves like a generic chatbot",
  "interaction feels like starting from zero",
  "hidden reasoning without trace",
  "urgency without evidence",
] as const;

export const BEHAVIORAL_INDICATORS = [
  "high_return_rate_after_first_use",
  "reduced_repetition_of_prior_information",
  "shorter_follow_up_interactions",
  "natural_continuation_phrases",
  "caregiver_reports_no_re_explanation",
] as const;

export const CONTINUATION_PHRASES = [
  /\bit happened again\b/i,
  /\bagain today\b/i,
  /\bstill refusing\b/i,
  /\bsame (?:thing|issue|problem)\b/i,
  /\banother (?:fall|incident|time)\b/i,
  /\bsecond (?:fall|time|incident)\b/i,
  /\bno change\b/i,
  /\bworse\b/i,
  /\bbetter\b/i,
  /\bshe'?s still\b/i,
  /\bhe'?s still\b/i,
] as const;

export const DEFINING_PRINCIPLE =
  "solenos is not successful because it gives good answers. It is successful because caregivers feel continuity — remembered, understood, evolving.";

export const ENGINEERING_DECISION_RULE =
  "If an implementation does not strengthen continuity, reduce cognitive burden, or make the caregiver feel understood without unnecessary repetition, reconsider it.";
