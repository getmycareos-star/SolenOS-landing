export const COMPRESSION_LIMITS = {
  what_is_happening_max_words: 80,
  what_matters_now_max_bullets: 5,
  what_to_ask_next_max_questions: 5,
  what_can_wait_max_bullets: 3,
} as const;

export type OutputCompressionViolationCode =
  | "happening_over_word_limit"
  | "matters_over_bullet_limit"
  | "ask_over_question_limit"
  | "can_wait_over_bullet_limit"
  | "total_over_word_limit";

export interface OutputCompressionResult {
  valid: boolean;
  violations: OutputCompressionViolationCode[];
}
