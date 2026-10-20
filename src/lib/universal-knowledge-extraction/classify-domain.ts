import type { DocumentTypeTag } from "../document-intake/types";
import type { SolenOSDocument } from "../document-intelligence/types";
import type { KnowledgeDomain } from "./types";

const DOMAIN_FROM_TAG: Record<DocumentTypeTag, KnowledgeDomain> = {
  MEDICAL_DOCUMENT: "medical",
  INSURANCE_DOCUMENT: "financial",
  LEGAL_DOCUMENT: "legal",
  FINANCIAL_DOCUMENT: "financial",
  GOVERNMENT_BENEFIT_DOCUMENT: "financial",
  CARE_INSTRUCTION_DOCUMENT: "caregiving",
  MIXED_UNSTRUCTURED_DOCUMENT: "personal",
};

const DOMAIN_FROM_SOLENOS_TYPE: Record<SolenOSDocument, KnowledgeDomain> = {
  medical_document: "medical",
  insurance_document: "financial",
  benefits_document: "financial",
  legal_document: "legal",
  care_plan: "caregiving",
  general_document: "personal",
};

const TAG_PRIORITY: DocumentTypeTag[] = [
  "LEGAL_DOCUMENT",
  "MEDICAL_DOCUMENT",
  "INSURANCE_DOCUMENT",
  "FINANCIAL_DOCUMENT",
  "GOVERNMENT_BENEFIT_DOCUMENT",
  "CARE_INSTRUCTION_DOCUMENT",
  "MIXED_UNSTRUCTURED_DOCUMENT",
];

export function domainFromDocumentTags(tags: DocumentTypeTag[]): KnowledgeDomain {
  if (tags.length === 0) return "personal";
  for (const tag of TAG_PRIORITY) {
    if (tags.includes(tag)) return DOMAIN_FROM_TAG[tag];
  }
  return DOMAIN_FROM_TAG[tags[0]!] ?? "personal";
}

export function domainFromSolenOSDocumentType(type: SolenOSDocument): KnowledgeDomain {
  return DOMAIN_FROM_SOLENOS_TYPE[type] ?? "personal";
}

export const DOMAIN_LABELS: Record<KnowledgeDomain, string> = {
  medical: "Medical",
  legal: "Legal",
  financial: "Financial",
  administrative: "Administrative",
  caregiving: "Caregiving",
  personal: "Personal",
};
