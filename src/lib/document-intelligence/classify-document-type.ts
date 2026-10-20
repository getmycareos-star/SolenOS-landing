import type { DocumentTypeTag } from "../document-intake/types";
import { DOCUMENT_TAG_PATTERNS } from "../document-intake/patterns";
import type { SolenOSDocument } from "./types";

const INTAKE_TAG_TO_SOLENOS: Partial<Record<DocumentTypeTag, SolenOSDocument>> = {
  MEDICAL_DOCUMENT: "medical_document",
  INSURANCE_DOCUMENT: "insurance_document",
  GOVERNMENT_BENEFIT_DOCUMENT: "benefits_document",
  LEGAL_DOCUMENT: "legal_document",
  CARE_INSTRUCTION_DOCUMENT: "care_plan",
  FINANCIAL_DOCUMENT: "general_document",
  MIXED_UNSTRUCTURED_DOCUMENT: "general_document",
};

/** Map document-intake organizational tags to SolenOSDocument source types. */
export function classifySolenOSDocumentType(
  intakeTags: readonly DocumentTypeTag[],
): SolenOSDocument {
  for (const tag of intakeTags) {
    const mapped = INTAKE_TAG_TO_SOLENOS[tag];
    if (mapped && mapped !== "general_document") return mapped;
  }

  if (intakeTags.includes("MEDICAL_DOCUMENT")) return "medical_document";
  if (intakeTags.includes("INSURANCE_DOCUMENT")) return "insurance_document";
  if (intakeTags.includes("GOVERNMENT_BENEFIT_DOCUMENT")) return "benefits_document";
  if (intakeTags.includes("LEGAL_DOCUMENT")) return "legal_document";
  if (intakeTags.includes("CARE_INSTRUCTION_DOCUMENT")) return "care_plan";

  return "general_document";
}

/** Re-detect type from raw text when intake tags are empty but document markers present. */
export function detectSolenOSDocumentTypeFromText(text: string): SolenOSDocument {
  const scores = new Map<SolenOSDocument, number>();

  const patternMap: [SolenOSDocument, RegExp][] = [
    ["medical_document", DOCUMENT_TAG_PATTERNS.MEDICAL_DOCUMENT],
    ["insurance_document", DOCUMENT_TAG_PATTERNS.INSURANCE_DOCUMENT],
    ["benefits_document", DOCUMENT_TAG_PATTERNS.GOVERNMENT_BENEFIT_DOCUMENT],
    ["legal_document", DOCUMENT_TAG_PATTERNS.LEGAL_DOCUMENT],
    ["care_plan", DOCUMENT_TAG_PATTERNS.CARE_INSTRUCTION_DOCUMENT],
  ];

  for (const [type, pattern] of patternMap) {
    const matches = text.match(new RegExp(pattern.source, "gi"));
    if (matches) scores.set(type, matches.length);
  }

  let best: SolenOSDocument = "general_document";
  let bestScore = 0;
  for (const [type, score] of scores) {
    if (score > bestScore) {
      best = type;
      bestScore = score;
    }
  }
  return best;
}
