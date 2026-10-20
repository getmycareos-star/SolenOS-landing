import {
  ASSISTANT_PERSONALITY_PATTERNS,
  CONVERSATIONAL_FRAMING_PATTERNS,
  CONVERSATIONAL_QUESTION_PATTERNS,
  DIALOGUE_WRAPPER_PATTERNS,
  FILLER_PHRASE_PATTERNS,
  GREETING_PATTERNS,
  INTERACTIVE_ENGAGEMENT_PATTERNS,
} from "../non-conversational/constants";

export type NonAssistantViolationCode =
  | "conversational"
  | "assistant_continuation"
  | "narrative"
  | "emotional_expansion";

export const NON_ASSISTANT_VIOLATION_CODES: readonly NonAssistantViolationCode[] = [
  "conversational",
  "assistant_continuation",
  "narrative",
  "emotional_expansion",
] as const;

/** Spec conversational patterns + non-conversational overlap. */
export const CONVERSATIONAL_PATTERNS = [
  /\bit sounds like\b/i,
  /\bit seems like\b/i,
  /\bi think\b/i,
  /\bi understand that\b/i,
  /\byou may be experiencing\b/i,
  /\byou might want to\b/i,
  ...GREETING_PATTERNS,
  ...CONVERSATIONAL_FRAMING_PATTERNS,
  ...CONVERSATIONAL_QUESTION_PATTERNS,
  ...DIALOGUE_WRAPPER_PATTERNS,
] as const;

/** Spec assistant continuation patterns + non-conversational overlap. */
export const ASSISTANT_CONTINUATION_PATTERNS = [
  /\blet me know if\b/i,
  /\bi can help with\b/i,
  /\bwould you like me to\b/i,
  /\bfeel free to ask\b/i,
  /\bi'?m here to help\b/i,
  ...FILLER_PHRASE_PATTERNS,
  ...ASSISTANT_PERSONALITY_PATTERNS,
  ...INTERACTIVE_ENGAGEMENT_PATTERNS,
] as const;

/** Narrative / reasoning explainer patterns. */
export const NARRATIVE_PATTERNS = [
  /\bhere'?s why\b/i,
  /\bhere is why\b/i,
  /\bthe reason (?:is|that)\b/i,
  /\bin other words\b/i,
  /\bto (?:summarize|wrap up|conclude)\b/i,
  /\blet me walk you through\b/i,
  /\bwhat this means is\b/i,
  /\bfor context\b/i,
  /\bto put (?:it|this) (?:simply|another way)\b/i,
] as const;

/** Emotional expansion / sympathy loop patterns. */
export const EMOTIONAL_EXPANSION_PATTERNS = [
  /\bthat must be\b/i,
  /\bi hear you\b/i,
  /\byou'?re not alone\b/i,
  /\bit'?s (?:completely |totally )?(?:normal|understandable|valid)\b/i,
  /\bi'?m sorry you'?re (?:going through|dealing with)\b/i,
  /\bthat sounds (?:really |very )?(?:hard|difficult|stressful|overwhelming)\b/i,
  /\byou'?re doing (?:great|amazing|wonderful)\b/i,
  /\bhang in there\b/i,
] as const;

/** Max one short acknowledgment allowed across all text fields. */
export const SHORT_ACKNOWLEDGMENT_PATTERNS = [
  /\bthis situation appears stressful\b/i,
  /\bthis appears stressful\b/i,
  /\bthis seems stressful\b/i,
  /\bthis is a stressful situation\b/i,
] as const;

export const NON_ASSISTANT_FORBIDDEN_PATTERN_COUNT =
  CONVERSATIONAL_PATTERNS.length +
  ASSISTANT_CONTINUATION_PATTERNS.length +
  NARRATIVE_PATTERNS.length +
  EMOTIONAL_EXPANSION_PATTERNS.length;

export interface NonAssistantResult {
  valid: boolean;
  violations: NonAssistantViolationCode[];
}
