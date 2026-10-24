import type { DocumentConfidence, ExtractedDocument, InferredDocument } from "./types";

/**
 * No OCR/provider calibration is available in this path. Extraction density,
 * field count, and ambiguity counts are not probabilities, so confidence stays
 * explicitly unknown instead of being manufactured from heuristics.
 */
export function computeDocumentConfidence(
  extracted: ExtractedDocument,
  inference: InferredDocument,
  structureValid: boolean,
): DocumentConfidence {
  return {
    extraction: null,
    structure: null,
    inference: null,
    overall: null,
    uncertaintyFlagged:
      !structureValid ||
      !extracted.rawText.trim() ||
      inference.ambiguityFlags.length > 0,
  };
}

export function applyLowConfidenceRules(confidence: DocumentConfidence): string[] {
  const rules = [
    "document_confidence_unavailable",
    "review_source_text_before_decision",
    "surface_ambiguity_not_assume_missing_fields",
  ];
  if (!confidence.uncertaintyFlagged) return rules.slice(0, 2);
  return rules;
}
