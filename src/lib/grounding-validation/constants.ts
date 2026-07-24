export type GroundingViolationCode =
  | "inferred_condition"
  | "guessed_cause"
  | "likely_statement"
  | "completed_missing_data"
  | "external_knowledge_unlabeled"
  | "ungrounded_risk_classification"
  | "ungrounded_confidence"
  | "fact_interpretation_mix";

export const GROUNDING_VIOLATION_CODES: readonly GroundingViolationCode[] = [
  "inferred_condition",
  "guessed_cause",
  "likely_statement",
  "completed_missing_data",
  "external_knowledge_unlabeled",
  "ungrounded_risk_classification",
  "ungrounded_confidence",
  "fact_interpretation_mix",
] as const;

/** Inference / hallucination language — hard stop. */
export const INFERENCE_LANGUAGE_PATTERNS = [
  /\blikely (?:that |is |to be |has |have )/i,
  /\bprobably (?:is |has |have |caused|due to)/i,
  /\bappears to (?:have|be|indicate|suggest)/i,
  /\bsuggests (?:that )?(?:she|he|they|the patient|this) (?:has|is|was)/i,
  /\bindicates (?:that )?(?:she|he|they|the patient) (?:has|is|was)/i,
  /\bmust be (?:caused by|due to|a sign of)/i,
  /\bis caused by\b/i,
  /\bthe cause is\b/i,
  /\bdiagnosed with\b/i,
  /\bhas (?:a |an )?(?:condition|disease|disorder|infection)\b/i,
  /\bthis is (?:a |an )?(?:case of|instance of)\b/i,
  /\bcompleted? the missing\b/i,
] as const;

export const GUESSED_CAUSE_PATTERNS = [
  /\b(?:because|due to|caused by) (?:stress|anxiety|depression|infection|stroke|heart attack|pneumonia|uti|dementia)\b/i,
  /\bthe reason (?:is|was|must be)\b/i,
] as const;

export const EXTERNAL_KNOWLEDGE_PATTERNS = [
  /\b(?:patients|people|individuals) (?:typically|usually|generally|often)\b/i,
  /\bin most cases\b/i,
  /\bclinically speaking\b/i,
  /\bmedical literature\b/i,
] as const;

export const GENERAL_PATTERN_LABEL = /\bgeneral caregiving pattern\b/i;

export const INPUT_REFERENCE_MARKERS =
  /\b(caregiver reports|from (?:the )?input|provided data|based on (?:what was|the information)|cannot be determined from input|missing from input|not stated in input)\b/i;

export interface GroundingValidationResult {
  valid: boolean;
  violations: GroundingViolationCode[];
}

