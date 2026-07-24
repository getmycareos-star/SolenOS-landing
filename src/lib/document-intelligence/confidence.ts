import { DOCUMENT_CONFIDENCE_THRESHOLD } from "./contract-constants";
import type { DocumentConfidence, ExtractedDocument, InferredDocument } from "./types";

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function countExtractedItems(extracted: ExtractedDocument): number {
  let count = extracted.entities.length + extracted.timestamps.length;
  count += extracted.obligations.length + extracted.constraints.length;
  for (const value of Object.values(extracted.extractedFields)) {
    if (Array.isArray(value)) count += value.length;
  }
  return count;
}

/**
 * Confidence model — extraction, structure, inference scored independently.
 * Overall below threshold flags uncertainty without assuming missing fields.
 */
export function computeDocumentConfidence(
  extracted: ExtractedDocument,
  inference: InferredDocument,
  structureValid: boolean,
): DocumentConfidence {
  const textLength = Math.max(extracted.rawText.length, 1);
  const itemCount = countExtractedItems(extracted);

  const extractionDensity = itemCount / Math.max(textLength / 100, 1);
  const extraction = clamp(0.3 + Math.min(extractionDensity * 0.15, 0.6));

  const requiredArraysPresent =
    Array.isArray(extracted.entities) &&
    Array.isArray(extracted.timestamps) &&
    Array.isArray(extracted.obligations) &&
    Array.isArray(extracted.constraints);

  const structure =
    structureValid && requiredArraysPresent
      ? clamp(0.5 + Math.min(Object.keys(extracted.extractedFields).length * 0.08, 0.45))
      : 0.3;

  const ambiguityPenalty = inference.ambiguityFlags.length * 0.08;
  const inferenceScore = clamp(0.65 - ambiguityPenalty);

  const overall = clamp(extraction * 0.4 + structure * 0.35 + inferenceScore * 0.25);
  const uncertaintyFlagged = overall < DOCUMENT_CONFIDENCE_THRESHOLD;

  return {
    extraction,
    structure,
    inference: inferenceScore,
    overall,
    uncertaintyFlagged,
  };
}

export function applyLowConfidenceRules(confidence: DocumentConfidence): string[] {
  if (!confidence.uncertaintyFlagged) return [];

  return [
    "document_confidence_below_threshold",
    "avoid_decision_making_from_document",
    "surface_ambiguity_not_assume_missing_fields",
  ];
}
