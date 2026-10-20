import type { DocumentTypeTag } from "./types";

export const DOCUMENT_TAG_PATTERNS: Readonly<
  Record<Exclude<DocumentTypeTag, "MIXED_UNSTRUCTURED_DOCUMENT">, RegExp>
> = {
  MEDICAL_DOCUMENT:
    /\b(discharge summary|patient|diagnosis|prescription|hospital|clinic|physician|medical record|lab result|vitals)\b/i,
  INSURANCE_DOCUMENT:
    /\b(insurance|claim|coverage|prior authorization|deductible|copay|policy number|beneficiary)\b/i,
  LEGAL_DOCUMENT:
    /\b(legal notice|attorney|court|pursuant|herein|plaintiff|defendant|subpoena|whereas)\b/i,
  FINANCIAL_DOCUMENT:
    /\b(invoice|billing statement|payment due|amount due|balance owed|account number|statement period)\b/i,
  GOVERNMENT_BENEFIT_DOCUMENT:
    /\b(medicare|medicaid|social security|ssi|ssdi|benefits office|government benefit|snap|ebt)\b/i,
  CARE_INSTRUCTION_DOCUMENT:
    /\b(care plan|caregiver instruction|medication schedule|home care|care instruction)\b/i,
};

/** OCR / scan / PDF markers — organizational only. */
export const DOCUMENT_INPUT_MARKERS =
  /\b(pdf|scanned|ocr|handwritten|uploaded document|attachment|page \d+ of|letter dated)\b/i;

export const MULTI_DOCUMENT_BOUNDARY_PATTERN =
  /(?:^|\n)(?:---+|={3,}|Document\s+\d+|PAGE\s+\d+\s*\/\s*\d+)/gim;
