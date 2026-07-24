export {
  DOCUMENT_INTELLIGENCE_LAYER_IDENTITY,
  DOCUMENT_INTELLIGENCE_LAYER_ONE_LINE_TRUTH,
  DOCUMENT_INTELLIGENCE_LAYER_PIPELINE_POSITION,
  DOCUMENT_INTELLIGENCE_LAYER_FORBIDDEN,
  SOLENOS_DOCUMENT_TYPES,
  DOCUMENT_SIGNAL_URGENCY_LEVELS,
  DOCUMENT_CONFIDENCE_THRESHOLD,
  DOCUMENT_EXTRACTION_FIELD_KEYS,
} from "./contract-constants";

export type {
  SolenOSDocument,
  DocumentSignalUrgency,
  DocumentExtractionFieldKey,
  ExtractedDocument,
  InferredDocument,
  DocumentConfidence,
  DocumentSignals,
  DocumentNode,
  DocumentMemoryProposalStatus,
  DocumentMemoryProposal,
  DocumentConflictCandidate,
  DocumentIntelligenceMemoryLink,
  DocumentIntelligenceSystemGuaranteeResult,
  DocumentIntelligenceLayerResult,
  DocumentIntelligenceLayerPayload,
  DocumentReasoningOutput,
} from "./types";

export {
  classifySolenOSDocumentType,
  detectSolenOSDocumentTypeFromText,
} from "./classify-document-type";
export { extractRawFields, type RawExtractionResult } from "./extraction";
export {
  structureExtractedDocument,
  validateExtractedDocumentStructure,
} from "./structuring";
export {
  separateInference,
  assertExtractionInferenceSeparation,
} from "./inference-separation";
export { computeDocumentConfidence, applyLowConfidenceRules } from "./confidence";
export { generateDocumentSignals, derivePrioritySignals } from "./signals";
export {
  proposeMemoryLinks,
  mergeMemoryLinks,
  assertNoMemoryAutoCommit,
} from "./memory-proposals";
export {
  runDocumentIntelligenceSystemGuarantee,
  validateDocumentIntelligenceLayerResult,
} from "./guarantee";
export {
  toMemoryInfluenceSignalProposals,
  assertDocumentProposalsNotApplied,
} from "./memory-influence-bridge";
export {
  processDocumentIntelligenceLayer,
  toDocumentIntelligenceLayerPayload,
  buildDocumentReasoningOutput,
  formatDocumentIntelligenceObservation,
  type ProcessDocumentIntelligenceParams,
} from "./process-document-intelligence";
