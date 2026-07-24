export type CognitiveClarityViolationCode =
  | "overintellectualized_language"
  | "excessive_sentence_length"
  | "jargon_detected"
  | "cognitive_load_excessive";

export const COGNITIVE_CLARITY_VIOLATION_CODES: readonly CognitiveClarityViolationCode[] =
  [
    "overintellectualized_language",
    "excessive_sentence_length",
    "jargon_detected",
    "cognitive_load_excessive",
  ] as const;

export const ACADEMIC_PHRASING_PATTERNS = [
  /\bfurthermore\b/i,
  /\bnevertheless\b/i,
  /\bconsequently\b/i,
  /\bin conclusion\b/i,
  /\bnotwithstanding\b/i,
  /\bparadigm\b/i,
  /\bmultifactorial\b/i,
  /\bpathophysiolog/i,
  /\bepistemolog/i,
  /\bphenomenolog/i,
] as const;

export const UNNECESSARY_JARGON_PATTERNS = [
  /\butilize\b/i,
  /\bfacilitate\b/i,
  /\bmanifestation\b/i,
  /\bexacerbation\b/i,
  /\bcontraindication\b/i,
  /\bdiagnostic framework\b/i,
] as const;

export const MAX_SENTENCE_CHARS = 200;
export const MAX_AVERAGE_WORDS_PER_SENTENCE = 28;
export const MAX_PRIMARY_FIELD_CHARS = 600;

export interface CognitiveClarityResult {
  valid: boolean;
  violations: CognitiveClarityViolationCode[];
}
