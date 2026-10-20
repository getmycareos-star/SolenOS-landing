export type ChaosToClarityViolationCode =
  | "narrative_synthesis"
  | "inference_completion"
  | "causality_invention"
  | "contradiction_reconciliation"
  | "reasoning_engine_language"
  | "summarizer_behavior"
  | "knowledge_completion"
  | "missing_uncertainty_separation";

export const CHAOS_TO_CLARITY_VIOLATION_CODES: readonly ChaosToClarityViolationCode[] =
  [
    "narrative_synthesis",
    "inference_completion",
    "causality_invention",
    "contradiction_reconciliation",
    "reasoning_engine_language",
    "summarizer_behavior",
    "knowledge_completion",
    "missing_uncertainty_separation",
  ] as const;

/** Section 5 — forbidden narrative completion patterns. */
export const NARRATIVE_SYNTHESIS_PATTERNS = [
  /\bputting (?:it|this|everything) together\b/i,
  /\bthe (?:full|complete) (?:story|picture|account)\b/i,
  /\bcoherent(?:ly)?\s+(?:explains|accounts for|describes)\b/i,
  /\b(?:sequence of events|timeline)\s+(?:shows|suggests|indicates|reveals)\b/i,
  /\bnarrative (?:is|suggests|indicates)\b/i,
  /\bclean(?:ed)? (?:up|version of) (?:the )?(?:story|account|events)\b/i,
  /\breconstructed (?:the )?(?:story|sequence|events)\b/i,
] as const;

export const INFERENCE_COMPLETION_PATTERNS = [
  /\bwe can (?:conclude|infer|deduce|determine)\b/i,
  /\bthis (?:clearly )?(?:means|implies|proves) that\b/i,
  /\bthe (?:underlying|root|real) cause (?:is|was)\b/i,
  /\bmost likely explanation\b/i,
  /\bit (?:must have|would have) (?:been|happened|occurred)\b/i,
  /\bhidden context (?:is|was|suggests)\b/i,
  /\bfill(?:ed|ing)? in the gaps\b/i,
  /\bresolved the ambiguity\b/i,
] as const;

export const CAUSALITY_INVENTION_PATTERNS = [
  /\bwhich (?:caused|led to|resulted in|triggered)\b/i,
  /\bbecause (?:she|he|they|it) (?:must have|probably|likely)\b/i,
  /\b(?:therefore|thus|hence),?\s+(?:she|he|they|it)\b/i,
] as const;

export const CONTRADICTION_RECONCILIATION_PATTERNS = [
  /\b(?:the correct|accurate|true) (?:version|account|story) is\b/i,
  /\b(?:actually|in reality|in truth),?\s+(?:she|he|they|it)\b/i,
  /\bresolving the (?:contradiction|inconsistency|conflict)\b/i,
  /\bone (?:statement|account|version) is (?:more )?(?:likely|correct|accurate)\b/i,
  /\bignoring the (?:earlier|previous|other) (?:statement|account)\b/i,
  /\bthe (?:conflicting|contradictory) (?:detail|statement) (?:is|was) (?:wrong|incorrect)\b/i,
] as const;

export const REASONING_ENGINE_PATTERNS = [
  /\btherefore\b/i,
  /\bthis (?:logically )?follows\b/i,
  /\bstep[- ]by[- ]step reasoning\b/i,
  /\breasoning (?:suggests|indicates|shows|leads)\b/i,
  /\b(?:deduce|deduced|deducing)\b/i,
] as const;

export const SUMMARIZER_BEHAVIOR_PATTERNS = [
  /\b(?:in (?:brief|short)|to summarize|tl;dr)\b/i,
  /\bsummary of (?:the )?(?:situation|events|input)\b/i,
  /\bkey takeaways?\b/i,
  /\bhigh[- ]level overview\b/i,
] as const;

export const KNOWLEDGE_COMPLETION_PATTERNS = [
  /\bstandard (?:procedure|protocol|practice) (?:is|would be)\b/i,
  /\b(?:typically|usually|generally),?\s+(?:in these cases|for this condition)\b/i,
  /\bmodel knowledge\b/i,
  /\bcommon (?:medical|clinical|caregiving) knowledge\b/i,
] as const;

export const UNCERTAINTY_SEPARATION_MARKERS =
  /\b(cannot be determined|unclear|uncertain|missing|not stated|unknown|contradict|inconsistent|conflicting|provided data|from (?:the )?input|caregiver reports)\b/i;

export interface ChaosToClarityResult {
  valid: boolean;
  violations: ChaosToClarityViolationCode[];
}
