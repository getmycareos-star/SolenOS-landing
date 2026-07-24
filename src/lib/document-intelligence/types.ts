import type {

  DOCUMENT_EXTRACTION_FIELD_KEYS,

  DOCUMENT_SIGNAL_URGENCY_LEVELS,

  SOLENOS_DOCUMENT_TYPES,

} from "./contract-constants";

import type { MemoryCategory } from "../memory-influence/types";



export type SolenOSDocument = (typeof SOLENOS_DOCUMENT_TYPES)[number];



export type DocumentSignalUrgency = (typeof DOCUMENT_SIGNAL_URGENCY_LEVELS)[number];



export type DocumentExtractionFieldKey = (typeof DOCUMENT_EXTRACTION_FIELD_KEYS)[number];



export type ExtractedDocument = {

  sourceType: SolenOSDocument;

  rawText: string;

  extractedFields: Record<string, unknown>;

  entities: string[];

  timestamps: string[];

  obligations: string[];

  constraints: string[];

};



export type InferredDocument = {

  /** System-derived labels — NEVER merged into extractedFields. */

  inferredFields: Record<string, unknown>;

  inferredCategories: string[];

  ambiguityFlags: string[];

  /** Explicitly labeled suggestions — not extracted truth. */

  suggestedInterpretations: string[];

};



export type DocumentConfidence = {

  extraction: number;

  structure: number;

  inference: number;

  overall: number;

  uncertaintyFlagged: boolean;

};



export type DocumentSignals = {

  urgency: DocumentSignalUrgency;

  category: SolenOSDocument;

  actionRequired: boolean;

};



export type DocumentNode = {

  id: string;

  type: SolenOSDocument;

  extracted: ExtractedDocument;

  inference: InferredDocument;

  linkedMemoryIds: string[];

  linkedCareContextIds: string[];

  prioritySignals: string[];

  confidence: DocumentConfidence;

};



export type DocumentMemoryProposalStatus = "pending";



export type DocumentMemoryProposal = {

  id: string;

  documentNodeId: string;

  category: MemoryCategory;

  suggestedKey: string;

  suggestedInfluenceLabel: string;

  confidence: number;

  status: DocumentMemoryProposalStatus;

};



export type DocumentConflictCandidate = {

  id: string;

  documentNodeId: string;

  field: string;

  extractedValue: string;

  reason: string;

};



export type DocumentIntelligenceMemoryLink = {

  suggestedUpdates: readonly DocumentMemoryProposal[];

  pendingWrites: readonly DocumentMemoryProposal[];

  conflictCandidates: readonly DocumentConflictCandidate[];

};



export type DocumentIntelligenceSystemGuaranteeResult = {

  ok: boolean;

  violations: string[];

};



export type DocumentIntelligenceLayerResult = {

  nodes: readonly DocumentNode[];

  signals: readonly DocumentSignals[];

  memoryLinks: DocumentIntelligenceMemoryLink;

  guarantee: DocumentIntelligenceSystemGuaranteeResult;

  skipped: boolean;

};



export type DocumentIntelligenceLayerPayload = {

  nodeCount: number;

  documentTypes: readonly SolenOSDocument[];

  overallConfidence: number;

  uncertaintyFlagged: boolean;

  signals: readonly DocumentSignals[];

  pendingMemoryWriteCount: number;

};



export type DocumentReasoningOutput = {

  extractionSection: ExtractedDocument[];

  inferenceSection: InferredDocument[];

  confidenceScores: DocumentConfidence[];

  uncertaintyFlags: string[];

};


