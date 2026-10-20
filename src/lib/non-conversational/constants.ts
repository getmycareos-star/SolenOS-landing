export type NonConversationalViolationCode =
  | "greeting"
  | "filler_phrase"
  | "conversational_framing"
  | "assistant_personality"
  | "interactive_engagement"
  | "conversational_question"
  | "dialogue_wrapper";

export const NON_CONVERSATIONAL_VIOLATION_CODES: readonly NonConversationalViolationCode[] =
  [
    "greeting",
    "filler_phrase",
    "conversational_framing",
    "assistant_personality",
    "interactive_engagement",
    "conversational_question",
    "dialogue_wrapper",
  ] as const;

export const GREETING_PATTERNS = [
  /^(?:hello|hi there|hey there|good (?:morning|afternoon|evening))\b/i,
  /\b(?:hello|hi there)[,!]?\s/i,
] as const;

export const FILLER_PHRASE_PATTERNS = [
  /\bi can help\b/i,
  /\blet me help\b/i,
  /\bhere'?s what i think\b/i,
  /\bsure[,!]?\s/i,
  /\bi'?d be happy to\b/i,
  /\bhow can i assist\b/i,
  /\bglad you asked\b/i,
] as const;

export const CONVERSATIONAL_FRAMING_PATTERNS = [
  /\b(let'?s (?:talk|walk) through|let me explain)\b/i,
  /\b(to answer your question)\b/i,
  /\b(based on what you(?:'ve| have) (?:said|shared|told me))\b/i,
  /\b(thanks for (?:sharing|reaching out))\b/i,
  /\bgreat question\b/i,
] as const;

export const ASSISTANT_PERSONALITY_PATTERNS = [
  /\bas an ai\b/i,
  /\bas your assistant\b/i,
  /\bi'?m here for you\b/i,
  /\bhelpful ai\b/i,
  /\bi understand how (?:hard|difficult|stressful) this is for you\b/i,
] as const;

export const INTERACTIVE_ENGAGEMENT_PATTERNS = [
  /\bfeel free to ask\b/i,
  /\blet me know if\b/i,
  /\bhope this helps\b/i,
  /\bdon'?t hesitate to\b/i,
  /\bhappy to help\b/i,
  /\bjust ask if\b/i,
] as const;

export const CONVERSATIONAL_QUESTION_PATTERNS = [
  /\bcould you tell me\b/i,
  /\bwould you mind\b/i,
  /\bcan you please tell me\b/i,
  /\bi'?d like to know if you\b/i,
  /\bdo you want to share\b/i,
  /\bcan you share more about\b/i,
] as const;

export const DIALOGUE_WRAPPER_PATTERNS = [
  /^sure[—-]/i,
  /^okay[—-]/i,
  /^alright[—-]/i,
] as const;

export interface NonConversationalResult {
  valid: boolean;
  violations: NonConversationalViolationCode[];
}
