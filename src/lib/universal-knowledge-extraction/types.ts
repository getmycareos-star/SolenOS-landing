import type { DocumentClarityOutput } from "../document-intake/types";
import type { DocumentNode, SolenOSDocument } from "../document-intelligence/types";
import type { CareJourneyPipelineResult } from "../care-journey-graph/types";
import type {
  CONFIDENCE_LEVELS,
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_DOMAINS,
} from "./contract-constants";

export type KnowledgeDomain = (typeof KNOWLEDGE_DOMAINS)[number];
export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

export type KnowledgeEvidence = {
  source_document_id: string;
  source_document_name: string;
  page_number: number | null;
  extraction_confidence: number;
  confidence_level: ConfidenceLevel;
  extracted_at: string;
  text_excerpt: string;
};

export type ExtractedKnowledgeItem = {
  id: string;
  category: KnowledgeCategory;
  domain: KnowledgeDomain;
  label: string;
  value: string;
  evidence: KnowledgeEvidence;
  review_status: "approved" | "pending_review";
  linked_journey_event_id: string | null;
};

export type KnowledgeRelationship = {
  id: string;
  from_item_id: string;
  to_item_id: string;
  relationship_type: "authorizes" | "requires" | "resulted_in" | "referenced_in" | "follow_up_for";
  note: string;
};

export type DocumentKnowledgeChanges = {
  summary: string[];
  new_diagnoses: string[];
  legal_authority_established: string[];
  medication_changes: string[];
  insurance_decisions: string[];
  follow_ups_required: string[];
  financial_obligations: string[];
  responsibility_changes: string[];
  care_plan_updates: string[];
};

export type DocumentKnowledgeResult = {
  document_id: string;
  document_name: string;
  document_type: SolenOSDocument;
  domain: KnowledgeDomain;
  knowledge_items: ExtractedKnowledgeItem[];
  relationships: KnowledgeRelationship[];
  clarity: DocumentClarityOutput;
  changes: DocumentKnowledgeChanges;
  follow_ups: string[];
  pending_review_count: number;
  approved_count: number;
  journey_results: CareJourneyPipelineResult[];
  document_node: DocumentNode;
  extracted_at: string;
};

export type ProcessDocumentKnowledgeParams = {
  document_id: string;
  document_name: string;
  extracted_text: string;
  caregiver_id?: string;
  case_id?: string | null;
  mime_type?: string;
  page_count?: number;
};

export type UniversalKnowledgeLayerPayload = {
  identity: string;
  boundary: string;
  document_id: string;
  document_name: string;
  domain: KnowledgeDomain;
  document_type: SolenOSDocument;
  approved_items: number;
  pending_review_items: number;
  changes_summary: string[];
  follow_ups: string[];
  clarity: DocumentClarityOutput;
  journey_event_ids: string[];
};
