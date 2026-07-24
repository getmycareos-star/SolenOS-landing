import type { SolenOSDocument } from "./types";

const DATE_PATTERNS = [
  /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2},?\s+\d{4}\b/gi,
  /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g,
  /\b\d{4}-\d{2}-\d{2}\b/g,
  /\b(?:by|before|due|deadline|expires?|effective)\s+(?:on\s+)?(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2},?\s+\d{4}\b/gi,
] as const;

const ENTITY_PATTERNS = [
  /\b(?:Dr\.|Doctor|Physician|Nurse|Hospital|Clinic|Department of|Office of)\s+[A-Z][A-Za-z.'\- ]{1,40}\b/g,
  /\b(?:policy|account|member|patient|claim|reference|case)\s*(?:#|number|no\.?|:)\s*[A-Z0-9-]{3,20}\b/gi,
  /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\s+(?:Inc|LLC|Corp|Hospital|Clinic|Insurance)\b/g,
] as const;

const OBLIGATION_PATTERNS = [
  /\b(?:must|shall|required to|you are required|need to|obligated to|responsible for)\s+[^.!?\n]{5,120}/gi,
  /\b(?:prior authorization required|authorization required|submit within|respond within|pay by)\b[^.!?\n]*/gi,
] as const;

const CONSTRAINT_PATTERNS = [
  /\b(?:do not|cannot|must not|shall not|never|prohibited|restricted from|unless|except when)\s+[^.!?\n]{5,120}/gi,
  /\b(?:not covered|excluded from|denied if|ineligible if)\b[^.!?\n]*/gi,
] as const;

const INSTRUCTION_PATTERNS = [
  /\b(?:take|administer|apply|complete|submit|call|contact|schedule|follow|monitor)\s+[^.!?\n]{5,120}/gi,
] as const;

const VALUE_PATTERNS = [
  /\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g,
  /\b\d+(?:\.\d+)?\s*(?:mg|ml|mcg|units?|days?|hours?|weeks?|months?)\b/gi,
] as const;

const COVERAGE_STATEMENT_PATTERN =
  /\b(?:covered|not covered|coverage|benefit|copay|deductible|coinsurance|prior auth(?:orization)?|pre-?authorization)\b[^.!?\n]*/gi;

const ELIGIBILITY_CRITERIA_PATTERN =
  /\b(?:eligible|eligibility|qualify|qualification|income limit|household size|age requirement|residency requirement)\b[^.!?\n]*/gi;

const LEGAL_CLAUSE_PATTERN =
  /\b(?:pursuant to|whereas|herein|hereby|notwithstanding|subject to|in accordance with|binding upon)\b[^.!?\n]*/gi;

const MEDICAL_FIELD_PATTERN =
  /\b(?:diagnosis|symptom|medication|dosage|treatment|prognosis|prescription|vitals|lab result)\b[^.!?\n]*/gi;

function uniqueNonEmpty(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    const key = trimmed.toLowerCase();
    if (trimmed.length < 3 || seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

function matchAll(text: string, patterns: readonly RegExp[]): string[] {
  const matches: string[] = [];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      if (match[0]) matches.push(match[0]);
    }
  }
  return matches;
}

export type RawExtractionResult = {
  dates: string[];
  entities: string[];
  obligations: string[];
  constraints: string[];
  instructions: string[];
  values: string[];
  conditions: string[];
  coverageStatements: string[];
  eligibilityCriteria: string[];
  legalClauses: string[];
  medicalFields: string[];
};

/**
 * STEP 1 — EXTRACTION: raw fields only. No interpretation, diagnosis, or eligibility determination.
 */
export function extractRawFields(text: string, sourceType: SolenOSDocument): RawExtractionResult {
  const trimmed = text.trim();

  const dates = uniqueNonEmpty(matchAll(trimmed, DATE_PATTERNS));
  const entities = uniqueNonEmpty(matchAll(trimmed, ENTITY_PATTERNS));
  const obligations = uniqueNonEmpty(matchAll(trimmed, OBLIGATION_PATTERNS));
  const constraints = uniqueNonEmpty(matchAll(trimmed, CONSTRAINT_PATTERNS));
  const instructions = uniqueNonEmpty(matchAll(trimmed, INSTRUCTION_PATTERNS));
  const values = uniqueNonEmpty(matchAll(trimmed, VALUE_PATTERNS));

  const conditions = uniqueNonEmpty([
    ...matchAll(trimmed, [/\b(?:if|when|provided that|only if|contingent on)\s+[^.!?\n]{5,120}/gi]),
  ]);

  let coverageStatements: string[] = [];
  let eligibilityCriteria: string[] = [];
  let legalClauses: string[] = [];
  let medicalFields: string[] = [];

  if (sourceType === "insurance_document") {
    coverageStatements = uniqueNonEmpty([...trimmed.matchAll(COVERAGE_STATEMENT_PATTERN)].map((m) => m[0]));
  }

  if (sourceType === "benefits_document") {
    eligibilityCriteria = uniqueNonEmpty([...trimmed.matchAll(ELIGIBILITY_CRITERIA_PATTERN)].map((m) => m[0]));
  }

  if (sourceType === "legal_document") {
    legalClauses = uniqueNonEmpty([...trimmed.matchAll(LEGAL_CLAUSE_PATTERN)].map((m) => m[0]));
  }

  if (sourceType === "medical_document" || sourceType === "care_plan") {
    medicalFields = uniqueNonEmpty([...trimmed.matchAll(MEDICAL_FIELD_PATTERN)].map((m) => m[0]));
  }

  return {
    dates,
    entities,
    obligations,
    constraints,
    instructions,
    values,
    conditions,
    coverageStatements,
    eligibilityCriteria,
    legalClauses,
    medicalFields,
  };
}
