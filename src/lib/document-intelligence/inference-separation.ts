import type { ExtractedDocument, InferredDocument, SolenOSDocument } from "./types";

const AMBIGUOUS_COVERAGE_MARKERS =
  /\b(may be covered|subject to review|pending|under review|determination pending|coverage decision|if medically necessary|at discretion)\b/i;

const AMBIGUOUS_ELIGIBILITY_MARKERS =
  /\b(may qualify|potentially eligible|eligibility varies|depends on|case-by-case|income-based)\b/i;

const ACTION_REQUIRED_MARKERS =
  /\b(required|must submit|deadline|due by|respond by|action needed|prior authorization|appeal by)\b/i;

/**
 * STEP 3 — INFERENCE SEPARATION: system-derived labels separated from extracted truth.
 * NEVER copies extracted field values into inferredFields.
 */
export function separateInference(
  extracted: ExtractedDocument,
  sourceType: SolenOSDocument,
): InferredDocument {
  const inferredFields: Record<string, unknown> = {};
  const inferredCategories: string[] = [];
  const ambiguityFlags: string[] = [];
  const suggestedInterpretations: string[] = [];

  inferredCategories.push(`document_category:${sourceType}`);

  if (extracted.obligations.length > 0) {
    inferredCategories.push("contains_obligations");
  }
  if (extracted.constraints.length > 0) {
    inferredCategories.push("contains_constraints");
  }
  if (extracted.timestamps.length > 0) {
    inferredCategories.push("contains_temporal_markers");
  }

  switch (sourceType) {
    case "medical_document":
    case "care_plan":
      inferredFields.documentDomain = "medical";
      inferredFields.extractionOnly = true;
      inferredFields.diagnosisInferred = false;
      suggestedInterpretations.push(
        "Medical content extracted as stated — no diagnosis or treatment validation performed.",
      );
      break;

    case "insurance_document":
      inferredFields.documentDomain = "insurance";
      if (AMBIGUOUS_COVERAGE_MARKERS.test(extracted.rawText)) {
        ambiguityFlags.push("coverage_language_ambiguous");
        suggestedInterpretations.push(
          "Coverage statements may require carrier verification — extracted clauses only.",
        );
      }
      for (const stmt of (extracted.extractedFields.coverageStatements as string[] | undefined) ?? []) {
        if (AMBIGUOUS_COVERAGE_MARKERS.test(stmt)) {
          ambiguityFlags.push(`ambiguous_coverage:${stmt.slice(0, 40)}`);
        }
      }
      break;

    case "benefits_document":
      inferredFields.documentDomain = "benefits";
      inferredFields.eligibilityDetermined = false;
      if (AMBIGUOUS_ELIGIBILITY_MARKERS.test(extracted.rawText)) {
        ambiguityFlags.push("eligibility_criteria_ambiguous");
        suggestedInterpretations.push(
          "Eligibility criteria extracted — eligibility NOT determined by system.",
        );
      }
      break;

    case "legal_document":
      inferredFields.documentDomain = "legal";
      inferredFields.legalOutcomeInterpreted = false;
      if (extracted.obligations.length > 0 || extracted.constraints.length > 0) {
        suggestedInterpretations.push(
          "Obligations and constraints extracted verbatim — legal meaning not interpreted as outcome.",
        );
      }
      break;

    default:
      inferredFields.documentDomain = "general";
      break;
  }

  if (ACTION_REQUIRED_MARKERS.test(extracted.rawText)) {
    inferredCategories.push("possible_action_required");
  }

  if (extracted.entities.length === 0 && extracted.rawText.length > 200) {
    ambiguityFlags.push("no_entities_detected_in_lengthy_document");
  }

  return {
    inferredFields,
    inferredCategories,
    ambiguityFlags,
    suggestedInterpretations,
  };
}

/** Guard: extracted and inference must remain in separate namespaces. */
export function assertExtractionInferenceSeparation(
  extracted: ExtractedDocument,
  inference: InferredDocument,
): boolean {
  for (const key of Object.keys(inference.inferredFields)) {
    if (key in extracted.extractedFields) return false;
  }
  return true;
}
