import {
  CARE_SEMANTIC_SIGNALS,
  SESSION_REENTRY_GREETING_PATTERNS,
} from "./contract-constants";
import type { EntryInputClassification } from "./types";

export function hasCareSemanticContent(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return CARE_SEMANTIC_SIGNALS.some((pattern) => pattern.test(trimmed));
}

export function isGreetingOrNonSemantic(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (SESSION_REENTRY_GREETING_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return true;
  }
  // Short free-text observations are still care signals unless they are pure greetings.
  // Only treat as non-semantic when there is no care signal AND the message is a tiny greeting-like token.
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length <= 1 && !hasCareSemanticContent(trimmed)) {
    return true;
  }
  return false;
}

/**
 * Classify entry input per Entry Behavior Protocol.
 * Greetings and context-less messages → SESSION_REENTRY_EVENT.
 */
export function classifyEntryInput(input: {
  raw_input: string;
  has_documents: boolean;
}): EntryInputClassification {
  if (input.has_documents) {
    return {
      kind: "CARE_EVENT",
      is_greeting: false,
      has_care_semantics: true,
      reason: "document_attachment",
    };
  }

  const text = input.raw_input.trim();

  if (!text) {
    return {
      kind: "SESSION_REENTRY_EVENT",
      is_greeting: false,
      has_care_semantics: false,
      reason: "empty_input",
    };
  }

  const hasCare = hasCareSemanticContent(text);
  if (hasCare) {
    return {
      kind: "CARE_EVENT",
      is_greeting: SESSION_REENTRY_GREETING_PATTERNS.some((p) => p.test(text)),
      has_care_semantics: true,
      reason: "care_semantic_content",
    };
  }

  if (isGreetingOrNonSemantic(text)) {
    return {
      kind: "SESSION_REENTRY_EVENT",
      is_greeting: SESSION_REENTRY_GREETING_PATTERNS.some((p) => p.test(text)),
      has_care_semantics: false,
      reason: "greeting_or_non_semantic",
    };
  }

  return {
    kind: "CARE_EVENT",
    is_greeting: false,
    has_care_semantics: false,
    reason: "unstructured_signal",
  };
}

export function isSessionReentryInput(input: {
  raw_input: string;
  has_documents: boolean;
}): boolean {
  return classifyEntryInput(input).kind === "SESSION_REENTRY_EVENT";
}
