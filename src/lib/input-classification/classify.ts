import {
  LOW_CONFIDENCE_DEFAULT_MODE,
  LOW_CONFIDENCE_THRESHOLD,
  type InputMode,
} from "./contract-constants";
import {
  ADMINISTRATIVE_LEGAL_SIGNALS,
  CRISIS_URGENT_SIGNALS,
  EMOTIONAL_NARRATIVE_SIGNALS,
  MEDICAL_DOCUMENT_SIGNALS,
} from "./signals";
import type { InputClassificationResult } from "./schema";

function countMatches(text: string, patterns: readonly RegExp[]): number {
  return patterns.filter((pattern) => pattern.test(text)).length;
}

function scoreMode(text: string, patterns: readonly RegExp[]): number {
  const matches = countMatches(text, patterns);
  if (matches === 0) return 0;
  if (matches >= 2) return 0.92;
  return 0.72;
}

/**
 * Surface-signal classifier — shallow, conservative, non-interpretive routing only.
 * Does NOT understand meaning. Selects behavioral constraints for downstream generation.
 */
export function classifyInputSurface(input: string): InputClassificationResult {
  const text = input.trim();
  if (!text) {
    return { mode: LOW_CONFIDENCE_DEFAULT_MODE, confidence: 0 };
  }

  const scores: Record<InputMode, number> = {
    crisis_urgent: scoreMode(text, CRISIS_URGENT_SIGNALS),
    medical_document: scoreMode(text, MEDICAL_DOCUMENT_SIGNALS),
    administrative_legal: scoreMode(text, ADMINISTRATIVE_LEGAL_SIGNALS),
    emotional_narrative: scoreMode(text, EMOTIONAL_NARRATIVE_SIGNALS),
  };

  const priority: InputMode[] = [
    "crisis_urgent",
    "medical_document",
    "administrative_legal",
    "emotional_narrative",
  ];

  let bestMode: InputMode = LOW_CONFIDENCE_DEFAULT_MODE;
  let bestScore = 0;

  for (const mode of priority) {
    if (scores[mode] > bestScore) {
      bestScore = scores[mode];
      bestMode = mode;
    }
  }

  if (bestScore < LOW_CONFIDENCE_THRESHOLD) {
    return { mode: LOW_CONFIDENCE_DEFAULT_MODE, confidence: bestScore };
  }

  return { mode: bestMode, confidence: bestScore };
}
