export {
  CORE_RUNTIME_IDENTITY,
  CORE_RUNTIME_ONE_LINE_TRUTH,
  CORE_RUNTIME_PIPELINE_STAGES,
  CORE_RUNTIME_TRUTH_LAYERS,
  CORE_RUNTIME_FORBIDDEN,
  CORE_RUNTIME_GAPS,
  CANONICAL_SITUATION_STATUSES,
  CANONICAL_PRIORITIES,
} from "./contract-constants";

export type {
  CanonicalSituationStatus,
  CanonicalPriority,
  Situation,
  CoreRuntimePipelineStage,
  TruthLayerSeparation,
  CoreRuntimeOrchestrationInput,
  CoreRuntimeOrchestrationResult,
} from "./types";

export {
  mapLifecycleToCanonical,
  mapCanonicalToLifecycle,
  mapUiToCanonical,
  mapCanonicalToUi,
  isOperationallyActiveCanonical,
  toCanonicalSituation,
  requireSituationOrNull,
} from "./situation";

export {
  orchestrateCoreRuntime,
  resetCoreRuntimeStoresForTests,
} from "./orchestrate";
