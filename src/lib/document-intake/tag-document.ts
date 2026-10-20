import type { StressNormalizedOutput } from "../input-stress-normalizer";
import {
  DOCUMENT_INPUT_MARKERS,
  DOCUMENT_TAG_PATTERNS,
  MULTI_DOCUMENT_BOUNDARY_PATTERN,
} from "./patterns";
import type { DocumentIntakeOutput, DocumentTypeTag } from "./types";

function detectDocumentTypeTags(text: string): DocumentTypeTag[] {
  const tags = new Set<DocumentTypeTag>();
  for (const [tag, pattern] of Object.entries(DOCUMENT_TAG_PATTERNS) as [
    Exclude<DocumentTypeTag, "MIXED_UNSTRUCTURED_DOCUMENT">,
    RegExp,
  ][]) {
    if (pattern.test(text)) tags.add(tag);
  }
  if (tags.size >= 2) {
    tags.add("MIXED_UNSTRUCTURED_DOCUMENT");
  }
  if (tags.size === 0 && DOCUMENT_INPUT_MARKERS.test(text)) {
    tags.add("MIXED_UNSTRUCTURED_DOCUMENT");
  }
  return [...tags].sort();
}

function countDocumentBoundaries(text: string): number {
  const matches = [...text.matchAll(MULTI_DOCUMENT_BOUNDARY_PATTERN)];
  return Math.max(1, matches.length);
}

function isDocumentInput(text: string, tags: DocumentTypeTag[]): boolean {
  if (tags.length > 0) return true;
  if (DOCUMENT_INPUT_MARKERS.test(text)) return true;
  if (/\bDocument\s+\d+\b/i.test(text)) return true;
  if (countDocumentBoundaries(text) > 1) return true;
  return false;
}

/** Section 6 — document type tagging (organizational only). */
export function tagDocumentInput(input: StressNormalizedOutput): DocumentIntakeOutput {
  const text = input.raw_input;
  const document_type_tags = detectDocumentTypeTags(text);
  const document_count = countDocumentBoundaries(text);
  const is_document_input = isDocumentInput(text, document_type_tags);

  return {
    document_type_tags,
    document_count,
    preserves_boundaries: document_count >= 1,
    extraction_priorities_applied: [
      "ACTION_CRITICAL",
      "STRUCTURAL_FACTS",
      "ENTITY_MAPPING",
      "UNCERTAINTY",
      "NARRATIVE_CONTENT",
    ],
    is_document_input,
  };
}

export function applyDocumentIntake(input: StressNormalizedOutput): DocumentIntakeOutput {
  return tagDocumentInput(input);
}
