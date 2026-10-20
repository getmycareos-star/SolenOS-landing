import type { SolenOSResponse } from "../response-validator";
import { collectCaregiverText, hasClarifyingQuestion } from "../solenos-fields";
import {
  ASSISTANT_PERSONALITY_PATTERNS,
  CONVERSATIONAL_FRAMING_PATTERNS,
  CONVERSATIONAL_QUESTION_PATTERNS,
  DIALOGUE_WRAPPER_PATTERNS,
  FILLER_PHRASE_PATTERNS,
  GREETING_PATTERNS,
  INTERACTIVE_ENGAGEMENT_PATTERNS,
  type NonConversationalResult,
  type NonConversationalViolationCode,
} from "./constants";

function matchAny(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

export function validateNonConversational(output: SolenOSResponse): NonConversationalResult {
  const text = collectCaregiverText(output);
  const violations = new Set<NonConversationalViolationCode>();

  if (matchAny(text, GREETING_PATTERNS)) {
    violations.add("greeting");
  }

  if (matchAny(text, FILLER_PHRASE_PATTERNS)) {
    violations.add("filler_phrase");
  }

  if (matchAny(text, CONVERSATIONAL_FRAMING_PATTERNS)) {
    violations.add("conversational_framing");
  }

  if (matchAny(text, ASSISTANT_PERSONALITY_PATTERNS)) {
    violations.add("assistant_personality");
  }

  if (matchAny(text, INTERACTIVE_ENGAGEMENT_PATTERNS)) {
    violations.add("interactive_engagement");
  }

  for (const field of [output.what_is_happening, output.what_matters_now, output.what_can_wait]) {
    if (matchAny(field.trim(), DIALOGUE_WRAPPER_PATTERNS)) {
      violations.add("dialogue_wrapper");
    }
  }

  if (matchAny(output.what_to_ask_next, CONVERSATIONAL_QUESTION_PATTERNS)) {
    violations.add("conversational_question");
  }

  if (matchAny(output.what_to_ask_next, INTERACTIVE_ENGAGEMENT_PATTERNS)) {
    violations.add("interactive_engagement");
  }

  return { valid: violations.size === 0, violations: [...violations] };
}

export function isNonConversationalValid(output: SolenOSResponse): boolean {
  return validateNonConversational(output).valid;
}
