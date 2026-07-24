import type { DocumentNode } from "../document-intelligence/types";
import { HUMAN_REVIEW_THRESHOLD } from "./contract-constants";
import { domainFromSolenOSDocumentType } from "./classify-domain";
import type {
  ConfidenceLevel,
  ExtractedKnowledgeItem,
  KnowledgeCategory,
  KnowledgeDomain,
  KnowledgeEvidence,
} from "./types";

function createItemId(): string {
  return `ki_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function confidenceLevel(score: number): ConfidenceLevel {
  if (score >= 0.7) return "high";
  if (score >= HUMAN_REVIEW_THRESHOLD) return "medium";
  return "low";
}

function reviewStatus(level: ConfidenceLevel): "approved" | "pending_review" {
  return level === "low" ? "pending_review" : "approved";
}

function buildEvidence(params: {
  document_id: string;
  document_name: string;
  excerpt: string;
  confidence: number;
  extracted_at: string;
}): KnowledgeEvidence {
  const level = confidenceLevel(params.confidence);
  return {
    source_document_id: params.document_id,
    source_document_name: params.document_name,
    page_number: null,
    extraction_confidence: params.confidence,
    confidence_level: level,
    extracted_at: params.extracted_at,
    text_excerpt: params.excerpt.slice(0, 200),
  };
}

function addItems(
  items: ExtractedKnowledgeItem[],
  params: {
    category: KnowledgeCategory;
    domain: KnowledgeDomain;
    label: string;
    values: string[];
    document_id: string;
    document_name: string;
    baseConfidence: number;
    extracted_at: string;
  },
): void {
  for (const value of params.values) {
    const evidence = buildEvidence({
      document_id: params.document_id,
      document_name: params.document_name,
      excerpt: value,
      confidence: params.baseConfidence,
      extracted_at: params.extracted_at,
    });
    items.push({
      id: createItemId(),
      category: params.category,
      domain: params.domain,
      label: params.label,
      value,
      evidence,
      review_status: reviewStatus(evidence.confidence_level),
      linked_journey_event_id: null,
    });
  }
}

const DIAGNOSIS_PATTERN = /\b(diagnosed with|diagnosis of|diagnosis:|dx:?)\s*([^.!?\n]{3,80})/gi;
const MEDICATION_PATTERN = /\b(?:take|prescribed|medication|medicine)\s+([^.!?\n]{3,80})/gi;
const LEGAL_AUTHORITY_PATTERN =
  /\b(power of attorney|poa|guardian|healthcare proxy|authorized agent|durable power)\b[^.!?\n]*/gi;
const APPOINTMENT_PATTERN =
  /\b(appointment|scheduled for|follow[- ]?up (?:on|for)|see (?:Dr|doctor))\b[^.!?\n]*/gi;

function extractPatternItems(
  text: string,
  pattern: RegExp,
  category: KnowledgeCategory,
  label: string,
): string[] {
  const results: string[] = [];
  for (const match of text.matchAll(pattern)) {
    const value = (match[0] ?? match[1] ?? "").trim();
    if (value.length >= 5) results.push(value);
  }
  return [...new Set(results)].slice(0, 8);
}

/**
 * Transform document intelligence nodes into universal structured knowledge items.
 * Facts only — no invented diagnoses or legal outcomes.
 */
export function extractKnowledgeItemsFromNode(
  node: DocumentNode,
  params: {
    document_id: string;
    document_name: string;
    extracted_at: string;
  },
): ExtractedKnowledgeItem[] {
  const items: ExtractedKnowledgeItem[] = [];
  const domain = domainFromSolenOSDocumentType(node.type);
  const baseConfidence = node.confidence.overall;
  const text = node.extracted.rawText;

  addItems(items, {
    category: "date",
    domain,
    label: "Date",
    values: node.extracted.timestamps.slice(0, 10),
    document_id: params.document_id,
    document_name: params.document_name,
    baseConfidence,
    extracted_at: params.extracted_at,
  });

  addItems(items, {
    category: "person",
    domain,
    label: "Person or organization",
    values: node.extracted.entities.slice(0, 10),
    document_id: params.document_id,
    document_name: params.document_name,
    baseConfidence: Math.min(baseConfidence + 0.05, 1),
    extracted_at: params.extracted_at,
  });

  addItems(items, {
    category: "responsibility",
    domain,
    label: "Responsibility or obligation",
    values: node.extracted.obligations.slice(0, 8),
    document_id: params.document_id,
    document_name: params.document_name,
    baseConfidence,
    extracted_at: params.extracted_at,
  });

  addItems(items, {
    category: "restriction",
    domain,
    label: "Restriction or constraint",
    values: node.extracted.constraints.slice(0, 8),
    document_id: params.document_id,
    document_name: params.document_name,
    baseConfidence,
    extracted_at: params.extracted_at,
  });

  const instructions = Array.isArray(node.extracted.extractedFields.instructions)
    ? (node.extracted.extractedFields.instructions as string[])
    : [];
  addItems(items, {
    category: "care_instruction",
    domain,
    label: "Care instruction",
    values: instructions.slice(0, 8),
    document_id: params.document_id,
    document_name: params.document_name,
    baseConfidence,
    extracted_at: params.extracted_at,
  });

  const values = Array.isArray(node.extracted.extractedFields.values)
    ? (node.extracted.extractedFields.values as string[])
    : [];
  addItems(items, {
    category: "financial_obligation",
    domain: domain === "medical" ? "financial" : domain,
    label: "Amount or quantity",
    values: values.filter((v) => v.includes("$")).slice(0, 6),
    document_id: params.document_id,
    document_name: params.document_name,
    baseConfidence,
    extracted_at: params.extracted_at,
  });

  addItems(items, {
    category: "deadline",
    domain,
    label: "Deadline",
    values: node.extracted.timestamps
      .filter((d) => /\b(due|by|before|deadline|expires?|effective)\b/i.test(d))
      .slice(0, 6),
    document_id: params.document_id,
    document_name: params.document_name,
    baseConfidence: Math.max(baseConfidence - 0.05, 0.3),
    extracted_at: params.extracted_at,
  });

  if (node.type === "legal_document") {
    const legalClauses = Array.isArray(node.extracted.extractedFields.legalClauses)
      ? (node.extracted.extractedFields.legalClauses as string[])
      : [];
    addItems(items, {
      category: "legal_authority",
      domain: "legal",
      label: "Legal clause",
      values: [
        ...extractPatternItems(text, LEGAL_AUTHORITY_PATTERN, "legal_authority", "Legal authority"),
        ...legalClauses.slice(0, 4),
      ],
      document_id: params.document_id,
      document_name: params.document_name,
      baseConfidence,
      extracted_at: params.extracted_at,
    });
  } else {
    const legalMatches = extractPatternItems(text, LEGAL_AUTHORITY_PATTERN, "legal_authority", "Legal authority");
    if (legalMatches.length > 0) {
      addItems(items, {
        category: "legal_authority",
        domain: "legal",
        label: "Legal authority",
        values: legalMatches,
        document_id: params.document_id,
        document_name: params.document_name,
        baseConfidence,
        extracted_at: params.extracted_at,
      });
    }
  }

  if (node.type === "medical_document" || node.type === "care_plan") {
    const medicalFields = Array.isArray(node.extracted.extractedFields.medicalFields)
      ? (node.extracted.extractedFields.medicalFields as string[])
      : [];
    addItems(items, {
      category: "diagnosis",
      domain: "medical",
      label: "Medical finding",
      values: [
        ...extractPatternItems(text, DIAGNOSIS_PATTERN, "diagnosis", "Diagnosis"),
        ...medicalFields.slice(0, 6),
      ],
      document_id: params.document_id,
      document_name: params.document_name,
      baseConfidence,
      extracted_at: params.extracted_at,
    });

    addItems(items, {
      category: "medication",
      domain: "medical",
      label: "Medication",
      values: extractPatternItems(text, MEDICATION_PATTERN, "medication", "Medication"),
      document_id: params.document_id,
      document_name: params.document_name,
      baseConfidence,
      extracted_at: params.extracted_at,
    });
  }

  if (node.type === "insurance_document" || node.type === "benefits_document") {
    const coverage = Array.isArray(node.extracted.extractedFields.coverageStatements)
      ? (node.extracted.extractedFields.coverageStatements as string[])
      : [];
    addItems(items, {
      category: "decision",
      domain: "financial",
      label: "Coverage statement",
      values: coverage.slice(0, 6),
      document_id: params.document_id,
      document_name: params.document_name,
      baseConfidence: Math.max(baseConfidence - 0.1, 0.35),
      extracted_at: params.extracted_at,
    });
  }

  addItems(items, {
    category: "appointment",
    domain: domain === "medical" ? "administrative" : domain,
    label: "Appointment or follow-up",
    values: extractPatternItems(text, APPOINTMENT_PATTERN, "appointment", "Appointment"),
    document_id: params.document_id,
    document_name: params.document_name,
    baseConfidence: Math.max(baseConfidence - 0.05, 0.35),
    extracted_at: params.extracted_at,
  });

  for (const flag of node.inference.ambiguityFlags.slice(0, 5)) {
    const evidence = buildEvidence({
      document_id: params.document_id,
      document_name: params.document_name,
      excerpt: flag,
      confidence: 0.4,
      extracted_at: params.extracted_at,
    });
    items.push({
      id: createItemId(),
      category: "outstanding_question",
      domain,
      label: "Uncertainty flagged",
      value: flag,
      evidence,
      review_status: "pending_review",
      linked_journey_event_id: null,
    });
  }

  return items;
}
