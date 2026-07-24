import type { ExtractedDocument, SolenOSDocument } from "./types";
import { extractRawFields } from "./extraction";

/**
 * STEP 2 — STRUCTURING: assemble ExtractedDocument from raw extraction output.
 */
export function structureExtractedDocument(
  rawText: string,
  sourceType: SolenOSDocument,
): ExtractedDocument {
  const raw = extractRawFields(rawText, sourceType);

  const extractedFields: Record<string, unknown> = {
    dates: raw.dates,
    instructions: raw.instructions,
    values: raw.values,
    conditions: raw.conditions,
  };

  if (sourceType === "insurance_document" && raw.coverageStatements.length > 0) {
    extractedFields.coverageStatements = raw.coverageStatements;
  }

  if (sourceType === "benefits_document" && raw.eligibilityCriteria.length > 0) {
    extractedFields.eligibilityCriteria = raw.eligibilityCriteria;
  }

  if (sourceType === "legal_document" && raw.legalClauses.length > 0) {
    extractedFields.legalClauses = raw.legalClauses;
  }

  if (
    (sourceType === "medical_document" || sourceType === "care_plan") &&
    raw.medicalFields.length > 0
  ) {
    extractedFields.medicalFields = raw.medicalFields;
  }

  return {
    sourceType,
    rawText: rawText.trim(),
    extractedFields,
    entities: raw.entities,
    timestamps: raw.dates,
    obligations: raw.obligations,
    constraints: raw.constraints,
  };
}

export function validateExtractedDocumentStructure(doc: ExtractedDocument): boolean {
  return (
    typeof doc.sourceType === "string" &&
    typeof doc.rawText === "string" &&
    doc.rawText.length > 0 &&
    typeof doc.extractedFields === "object" &&
    doc.extractedFields !== null &&
    Array.isArray(doc.entities) &&
    Array.isArray(doc.timestamps) &&
    Array.isArray(doc.obligations) &&
    Array.isArray(doc.constraints)
  );
}
