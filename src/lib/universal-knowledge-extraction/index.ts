/**
 * Client-safe barrel. Pipeline + journey linking: `./server`.
 */
export {
  UNIVERSAL_KNOWLEDGE_IDENTITY,
  UNIVERSAL_KNOWLEDGE_BOUNDARY,
  UNIVERSAL_KNOWLEDGE_PIPELINE,
  KNOWLEDGE_DOMAINS,
  KNOWLEDGE_CATEGORIES,
  CONFIDENCE_LEVELS,
  HUMAN_REVIEW_THRESHOLD,
} from "./contract-constants";

export type {
  KnowledgeDomain,
  KnowledgeCategory,
  ConfidenceLevel,
  KnowledgeEvidence,
  ExtractedKnowledgeItem,
  KnowledgeRelationship,
  DocumentKnowledgeChanges,
  DocumentKnowledgeResult,
  ProcessDocumentKnowledgeParams,
  UniversalKnowledgeLayerPayload,
} from "./types";

export { domainFromDocumentTags, domainFromSolenOSDocumentType, DOMAIN_LABELS } from "./classify-domain";
export { extractKnowledgeItemsFromNode } from "./extract-knowledge-items";
export { buildDocumentClarityOutput } from "./build-clarity";
export { detectKnowledgeRelationships } from "./detect-knowledge-links";
export { assessDocumentChanges, extractFollowUps } from "./assess-changes";
export {
  storeDocumentKnowledge,
  getDocumentKnowledge,
  listDocumentKnowledgeForCaregiver,
  resetUniversalKnowledgeStore,
} from "./store";

export { toUniversalKnowledgeLayerPayload } from "./layer-payload";
