import type { SolenOSResponse } from "../response-validator";
import { collectCaregiverText } from "../solenos-fields";
import { HIGH_URGENCY_HEADER_PATTERN } from "../urgency-escalation/constants";
import {
  ACADEMIC_PHRASING_PATTERNS,
  MAX_AVERAGE_WORDS_PER_SENTENCE,
  MAX_PRIMARY_FIELD_CHARS,
  MAX_SENTENCE_CHARS,
  UNNECESSARY_JARGON_PATTERNS,
  type CognitiveClarityResult,
  type CognitiveClarityViolationCode,
} from "./constants";

const PRIMARY_FIELDS = ["what_is_happening", "what_matters_now"] as const satisfies ReadonlyArray<
  keyof SolenOSResponse
>;

function matchAny(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function averageWordsPerSentence(text: string): number {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return 0;
  const words = sentences.reduce(
    (sum, sentence) => sum + sentence.split(/\s+/).filter(Boolean).length,
    0,
  );
  return words / sentences.length;
}

function hasExcessiveSentenceLength(text: string): boolean {
  return splitSentences(text).some((sentence) => sentence.length > MAX_SENTENCE_CHARS);
}

function isHighUrgencyResponse(output: SolenOSResponse): boolean {
  return (
    output.risk_level === "high" &&
    HIGH_URGENCY_HEADER_PATTERN.test(output.what_matters_now)
  );
}

/** Anti-overintellectualization + cognitive load gate. */
export function validateCognitiveClarity(output: SolenOSResponse): CognitiveClarityResult {
  const combined = collectCaregiverText(output);
  const violations = new Set<CognitiveClarityViolationCode>();
  const highUrgency = isHighUrgencyResponse(output);

  if (matchAny(combined, ACADEMIC_PHRASING_PATTERNS)) {
    violations.add("overintellectualized_language");
  }

  if (matchAny(combined, UNNECESSARY_JARGON_PATTERNS)) {
    violations.add("jargon_detected");
  }

  for (const field of PRIMARY_FIELDS) {
    const text = output[field];
    if (!highUrgency && hasExcessiveSentenceLength(text)) {
      violations.add("excessive_sentence_length");
    }
    if (!highUrgency && averageWordsPerSentence(text) > MAX_AVERAGE_WORDS_PER_SENTENCE) {
      violations.add("cognitive_load_excessive");
    }
    if (!highUrgency && text.length > MAX_PRIMARY_FIELD_CHARS) {
      violations.add("cognitive_load_excessive");
    }
  }

  return { valid: violations.size === 0, violations: [...violations] };
}

export function isCognitiveClarityValid(output: SolenOSResponse): boolean {
  return validateCognitiveClarity(output).valid;
}
