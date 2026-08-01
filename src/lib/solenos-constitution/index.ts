/**
 * SolenOS AI Constitution — Module Entry Point
 *
 * Exports the constitution text, types, and helper functions
 * for runtime use across the intelligence pipeline.
 */
export { SOLENOS_CONSTITUTION } from "./constitution";
export {
  dependsOnLivingCareRecord,
  isGeneralKnowledgeType,
  detectCareIntelligenceSignal,
  classifyQuestionType,
  estimateConfidence,
  isNoiseForMemory,
  getKnowledgeLevelLabel,
  detectDecisionType,
} from "./constitution";

export type {
  SolenosConstitution,
  ThinkingStep,
  QuestionType,
  KnowledgeLevel,
  ConfidenceEstimate,
  CareIntelligenceSignal,
  DecisionType,
  TruthCategory,
  MemoryCategory,
  PatternDimension,
  SuccessMetric,
} from "./types";

export {
  KNOWLEDGE_LEVELS,
} from "./types";

