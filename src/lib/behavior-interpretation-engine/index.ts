export {
  BEHAVIOR_INTERPRETATION_IDENTITY,
  BEHAVIOR_ENGINE_BOUNDARY,
  BEHAVIOR_PROHIBITED,
  CONFIDENCE_LEVELS,
  BEHAVIOR_TAXONOMY_GROUPS,
  INVESTIGATION_DOMAINS,
  UNMET_NEED_CANDIDATES,
  REASONING_PIPELINE_STAGES,
} from "./contract-constants";

export type {
  BehaviorTaxonomyGroup,
  ConfidenceLevel,
  InvestigationDomain,
  UnmetNeed,
  ReasoningStage,
  BehaviorHypothesis,
  ObservedBehavior,
  InvestigationItem,
  EscalationAssessment,
  BehaviorKnowledgeNode,
  LongitudinalPattern,
  BehaviorInterpretationResult,
  ProcessBehaviorInterpretationInput,
} from "./types";

export { BEHAVIOR_TAXONOMY, matchBehaviorTaxonomy } from "./taxonomy";
export { classifyObservedBehaviors, detectBehavioralChange } from "./classify-behavior";
export { generateHypotheses, deriveUnmetNeeds } from "./interpret";
export { buildInvestigationChecklist, buildRecommendedApproach } from "./investigation";
export { assessEscalation } from "./escalation";
export { buildKnowledgeNodes } from "./knowledge-graph";
export { learnLongitudinalPatterns, resetBehaviorPatternStore } from "./patterns";
export {
  processBehaviorInterpretation,
  shouldTriggerBehaviorEngine,
} from "./pipeline";
