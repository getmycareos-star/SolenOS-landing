import { DOCUMENT_INPUT_MARKERS } from "../document-intake/patterns";
import type { DocumentIntakeOutput } from "../document-intake";
import type { DocumentIntelligenceLayerPayload } from "../document-intelligence";
import { DISCLAIMER_DOMAINS, type DisclaimerDomain } from "./types";

export const MEDICAL_TRIGGER_PATTERNS = [
  /\b(symptom|symptoms|diagnos(?:is|e|ed)|diagnostic|medication|prescription|dosage|treatment|prognosis|caregiving health|blood pressure|heart rate|fever|pain level|wound care|hospice|palliative)\b/i,
  /\b(doctor|physician|clinician|nurse|hospital|clinic|ER|emergency room)\b/i,
] as const;

export const INSURANCE_TRIGGER_PATTERNS = [
  /\b(insurance|claim|claims|billing|coverage|copay|deductible|prior auth(?:orization)?|policy number|beneficiary|EOB|explanation of benefits)\b/i,
] as const;

export const BENEFITS_TRIGGER_PATTERNS = [
  /\b(IHSS|SNAP|CALFRESH|LIHEAP|SSI|MEDI-?CAL|MEDICAID|CHARITY CARE|VA benefits|Veterans Affairs|MEDICARE|LONG TERM CARE|long-term care|Medi-Cal|CalFresh)\b/i,
  /\b(government benefit|benefits office|food stamps|in-home support)\b/i,
] as const;

function matchAny(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function documentDomainTriggered(
  rawInput: string,
  documentIntake?: DocumentIntakeOutput,
): boolean {
  if (documentIntake?.is_document_input) return true;
  if (DOCUMENT_INPUT_MARKERS.test(rawInput)) return true;
  return /\b(pdf|scan|scanned|upload|uploaded|attachment|handwritten)\b/i.test(rawInput);
}

const DOCUMENT_INTELLIGENCE_DOMAIN_MAP = {
  medical_document: "MEDICAL",
  insurance_document: "INSURANCE",
  benefits_document: "BENEFITS",
} as const;

function documentIntelligenceDomainTriggered(
  documentIntelligence?: DocumentIntelligenceLayerPayload,
): DisclaimerDomain[] {
  if (!documentIntelligence || documentIntelligence.nodeCount === 0) return [];
  const triggered: DisclaimerDomain[] = [];
  for (const docType of documentIntelligence.documentTypes) {
    const domain = DOCUMENT_INTELLIGENCE_DOMAIN_MAP[
      docType as keyof typeof DOCUMENT_INTELLIGENCE_DOMAIN_MAP
    ];
    if (domain) triggered.push(domain);
  }
  return triggered;
}

/**
 * Deterministic domain trigger scan — input and document tags only (post-reasoning).
 * Must NOT read model output fields to avoid feedback into reasoning.
 */
export function detectTriggeredDomains(
  rawInput: string,
  documentIntake?: DocumentIntakeOutput,
  documentIntelligence?: DocumentIntelligenceLayerPayload,
): DisclaimerDomain[] {
  const text = rawInput.trim();
  const triggered = new Set<DisclaimerDomain>();

  if (matchAny(text, MEDICAL_TRIGGER_PATTERNS)) triggered.add("MEDICAL");
  if (matchAny(text, INSURANCE_TRIGGER_PATTERNS)) triggered.add("INSURANCE");
  if (matchAny(text, BENEFITS_TRIGGER_PATTERNS)) triggered.add("BENEFITS");
  if (documentDomainTriggered(text, documentIntake)) triggered.add("DOCUMENT");

  for (const domain of documentIntelligenceDomainTriggered(documentIntelligence)) {
    triggered.add(domain);
  }

  return DISCLAIMER_DOMAINS.filter((domain) => triggered.has(domain));
}
