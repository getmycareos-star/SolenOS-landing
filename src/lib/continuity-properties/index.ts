export {
  SOURCE_RELIABILITY_TYPES,
  SOURCE_RELIABILITY_BASELINES,
  classifySourceReliability,
  resolveReliabilityConflict,
} from "./source-reliability";
export type { SourceReliability, SourceReliabilityType } from "./source-reliability";

export {
  UNKNOWN_PRIORITIES,
  deriveExplicitUnknowns,
  clarificationTargetsFromUnknowns,
} from "./explicit-unknowns";
export type {
  ExplicitUnknown,
  ExplicitUnknownsProjection,
  UnknownPriority,
} from "./explicit-unknowns";

export {
  CAREGIVER_FAILURE_CATEGORIES,
  FAILURE_TO_ENGINE_MAP,
  FEATURE_FAILURE_GATE,
  classifyFailureFromQuestion,
} from "./failure-map";
export type { CaregiverFailureCategory, FailureEngineMapping } from "./failure-map";

export {
  recordInference,
  applyInferenceFeedback,
  getInference,
  listPendingInferences,
  resetInferenceLearningStore,
  getLearningHistory,
} from "./inference-learning";
export type {
  InferenceVerdict,
  StoredInference,
  InferenceFeedback,
  LearningWeightUpdate,
} from "./inference-learning";

export type { ContinuityPropertiesResult } from "./types";
export {
  processContinuityProperties,
  resetContinuityPropertiesStore,
} from "./process";
