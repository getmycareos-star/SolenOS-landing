/**
 * Intelligence Layer — never hardcode examples as keyword/symptom detectors.
 * SoT: docs/02-product/solenos-intelligence-no-hardcode.md
 *
 * Doc examples = categories of care-reality change. Infer meaning from messy context.
 */

export const INTELLIGENCE_NO_HARDCODE_PURPOSE =
  "Reconstruct changing care reality from messy input — never match fixed words or symptom lists.";

/** Caregiver-facing reasoning structure (disclosure may thin fields). */
export const CARE_REALITY_REASONING_STRUCTURE = [
  "current_understanding",
  "what_changed",
  "important_context",
  "still_unclear",
  "what_would_help",
] as const;

/**
 * Engine attention ranking when many concerns appear in one capture.
 * Never expose these labels as caregiver chrome or keyword banks.
 */
export const CARE_REALITY_ATTENTION_RANK = [
  "condition_change",
  "safety_relevant_event",
  "care_decision",
  "functional_change",
  "unknown_or_missing_context",
  "contributor_emotion_or_family_dynamics",
] as const;

export type CareRealityAttentionRank = (typeof CARE_REALITY_ATTENTION_RANK)[number];

/** Product questions the intelligence layer must answer. */
export const INTELLIGENCE_LAYER_ASK =
  "What is happening with this person, what changed, what decisions happened, and what remains uncertain?";

export const INTELLIGENCE_LAYER_NEVER_ASK =
  "What words appeared in the caregiver's message?";

/**
 * Caregiver output that reveals keyword-classifier theater — reject.
 * Not a list of clinical terms to ban from understanding — bans *detection framing*.
 */
export const KEYWORD_CLASSIFIER_THEATER_PATTERNS = [
  /\bdetected keywords?\b/i,
  /\bkeywords? (?:detected|found|matched|identified)\b/i,
  /\bmatched (?:the )?(?:following )?keywords?\b/i,
  /\bsymptom (?:list|checker|classifier)\b/i,
  /\bflagged (?:the )?words?\b/i,
  /\b(?:contains|found) (?:the )?words?:/i,
] as const;

export function containsKeywordClassifierTheater(text: string): boolean {
  return KEYWORD_CLASSIFIER_THEATER_PATTERNS.some((p) => p.test(text));
}

/**
 * Rank a fragment for standout attention using extraction *layer* meaning —
 * never topic-noun keyword banks (fall, confusion, Mom, …).
 */
export function attentionRankForExtractionCategory(
  category:
    | "observation"
    | "event"
    | "decision"
    | "outcome"
    | "unknown"
    | "contributor_load"
    | "disagreement_perspective"
    | "skip"
    | string,
): number {
  // Lower number = higher priority (matches CARE_REALITY_ATTENTION_RANK intent)
  switch (category) {
    case "observation":
      return 0; // condition / baseline change evidence
    case "event":
      return 1; // safety-relevant and journey occurrences
    case "decision":
      return 2;
    case "outcome":
      return 2;
    case "unknown":
      return 4;
    case "contributor_load":
    case "disagreement_perspective":
      return 5;
    default:
      return 3;
  }
}
