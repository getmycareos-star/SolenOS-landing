import type { SolenOSResponse } from "../response-validator";
import { collectCaregiverText } from "../solenos-fields";
import {
  ASSISTANT_CONTINUATION_PATTERNS,
  CONVERSATIONAL_PATTERNS,
  EMOTIONAL_EXPANSION_PATTERNS,
  NARRATIVE_PATTERNS,
  SHORT_ACKNOWLEDGMENT_PATTERNS,
  type NonAssistantResult,
  type NonAssistantViolationCode,
} from "./constants";

function matchAny(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function countAcknowledgments(text: string): number {
  let count = 0;
  for (const pattern of SHORT_ACKNOWLEDGMENT_PATTERNS) {
    const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
    const matches = text.match(new RegExp(pattern.source, flags));
    if (matches) {
      count += matches.length;
    }
  }
  return count;
}

/** Style validation gate — rejects assistant/chatbot output before render. */
export function validateNonAssistantOutput(output: SolenOSResponse): NonAssistantResult {
  const text = collectCaregiverText(output);
  const violations = new Set<NonAssistantViolationCode>();

  if (matchAny(text, CONVERSATIONAL_PATTERNS)) {
    violations.add("conversational");
  }

  if (matchAny(text, ASSISTANT_CONTINUATION_PATTERNS)) {
    violations.add("assistant_continuation");
  }

  if (matchAny(text, NARRATIVE_PATTERNS)) {
    violations.add("narrative");
  }

  if (matchAny(text, EMOTIONAL_EXPANSION_PATTERNS) || countAcknowledgments(text) > 1) {
    violations.add("emotional_expansion");
  }

  return { valid: violations.size === 0, violations: [...violations] };
}

export function isNonAssistantOutputValid(output: SolenOSResponse): boolean {
  return validateNonAssistantOutput(output).valid;
}
