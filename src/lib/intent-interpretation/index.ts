/**
 * SolenOS Intelligence Layer — intent interpretation.
 *
 * Stage 0 of the canonical intelligence pipeline.
 * Classifies caregiver input by purpose, not format.
 *
 * This is the first step before extraction or understanding.
 * It answers: "Why is the caregiver providing this input?"
 */

export type InputIntent =
  | { kind: "new_observation"; confidence: "high" | "medium" | "low" }
  | { kind: "update_understanding"; confidence: "high" | "medium" | "low" }
  | { kind: "correction"; confidence: "high" | "medium" | "low" }
  | { kind: "document_evidence"; confidence: "high" | "medium" | "low" }
  | { kind: "question_seeking_orientation"; confidence: "high" | "medium" | "low" }
  | { kind: "caregiver_state_signal"; confidence: "high" | "medium" | "low" };

const CORRECTION_PATTERNS = /\b(?:actually|no\s+it'?s?|wrong|correction|mistake|update\s+(?:that|this)|not\s+(?:right|correct)|i\s+meant|instead)\b/i;

const QUESTION_PATTERNS = /\b(?:why|what|how|when|where|who|is\s+this|should\s+i|do\s+i|can\s+you|does\s+this)\b.*\?/i;

const CAREGIVER_STATE_PATTERNS = /\b(?:i'?m\s+(?:tired|exhausted|overwhelmed|stressed|worried|scared|anxious|frustrated|don'?t\s+know\s+what\s+to\s+do|can'?t\s+keep\s+up|burning\s+out)|i\s+don'?t\s+know|i\s+feel\s+like|it'?s\s+so\s+(?:hard|difficult|much)|nobody\s+(?:sees|understands|helps)|i\s+need\s+help|i\s+can'?t)\b/i;

const UPDATE_PATTERNS = /\b(?:update|changed\s+again|now\s+(?:he|she|they|mom|dad)\s+is|today\s+(?:he|she|they|mom|dad)\s+(?:is|seems|looks|started|stopped))\b/i;

export function interpretIntent(params: {
  rawText: string;
  hasDocuments: boolean;
  priorUnderstandingCount: number;
}): InputIntent {
  const { rawText, hasDocuments, priorUnderstandingCount } = params;
  const text = rawText.trim();
  const lower = text.toLowerCase();

  if (hasDocuments && text.length < 40) {
    return { kind: "document_evidence", confidence: "high" };
  }

  if (CORRECTION_PATTERNS.test(text) && priorUnderstandingCount > 0) {
    return { kind: "correction", confidence: "medium" };
  }

  if (QUESTION_PATTERNS.test(text)) {
    return { kind: "question_seeking_orientation", confidence: "high" };
  }

  if (CAREGIVER_STATE_PATTERNS.test(text) && !UPDATE_PATTERNS.test(text)) {
    return { kind: "caregiver_state_signal", confidence: "medium" };
  }

  if (UPDATE_PATTERNS.test(text) && priorUnderstandingCount > 0) {
    return { kind: "update_understanding", confidence: "medium" };
  }

  if (priorUnderstandingCount === 0) {
    return { kind: "new_observation", confidence: "high" };
  }

  return { kind: "new_observation", confidence: "medium" };
}

export function intentRequiresClarification(intent: InputIntent): boolean {
  return intent.kind === "question_seeking_orientation" || intent.kind === "caregiver_state_signal";
}

export function intentRequiresMemoryCorrection(intent: InputIntent): boolean {
  return intent.kind === "correction";
}
