/**
 * Caregiver Load Engine — unified facade for burden detection and reduction.
 * Consolidates: load-interpretation, interaction-load-signal, high-signal stress, dependency load.
 */

export {
  CAREGIVER_LOAD_ENGINE_IDENTITY,
  CAREGIVER_LOAD_ENGINE_NORTH_STAR,
  CAREGIVER_LOAD_ENGINE_ONE_LINE_TRUTH,
  CAREGIVER_LOAD_ENGINE_PIPELINE_POSITION,
  CAREGIVER_LOAD_ENGINE_ANTI_PATTERNS,
  CAREGIVER_LOAD_ENGINE_FORBIDDEN,
  LOAD_DIMENSION_HIT,
  LOAD_FIRST_EMOTIONAL_SCORE_THRESHOLD,
  LOAD_FIRST_BURNOUT_THRESHOLD,
  LOAD_FIRST_MIN_SIGNAL_CATEGORIES,
  DEPENDENCY_LOAD_PATTERNS,
  BURNOUT_FORMULA_WEIGHTS,
  ACTION_REDUCTION_LIMITS,
  LOAD_FIRST_MINIMAL_ACTION,
  LOAD_FIRST_SAFE_TO_IGNORE,
} from "./contract-constants";

export type {
  LoadDimension,
  LoadSignalFamily,
  DetectedLoadSignalFamilies,
  LoadScores,
  BurnoutTrend,
  BurnoutTier,
  BurnoutModel,
  ActionReductionStrategy,
  CaregiverProfile,
  CaregiverState,
  CaregiverLoadEngineLayerPayload,
  CaregiverLoadEngineLoadInterpretation,
  CaregiverLoadEngineResult,
  CaregiverLoadEngineForbidden,
} from "./types";

export { detectLoadSignalFamilies } from "./detect-signals";
export { scoreLoadDimensions } from "./score-loads";
export { computeBurnoutRisk, isLoadFirstBurnout, type ComputeBurnoutParams } from "./burnout-risk";
export {
  buildBurdenMessages,
  buildBurdenSummary,
  buildPrimaryContributors,
  type BuildBurdenMessagesParams,
} from "./burden-messages";
export {
  deriveActionReduction,
  evaluateLoadFirstMode,
  actionReductionFromState,
  type DeriveActionReductionParams,
} from "./action-reduction";
export {
  BURDEN_DRIVERS,
  STAGE_BURDEN_DRIVERS,
  FORBIDDEN_KNOWLEDGE_PATTERNS,
  inferDependencyStage,
  getStageBurdenFraming,
  containsForbiddenKnowledge,
  type DependencyStage,
  type BurdenDriver,
  type InferDependencyStageParams,
} from "./dementia-context";
export { buildCaregiverState } from "./caregiver-state";
export {
  processCaregiverLoadEngine,
  toCaregiverLoadEngineLayerPayload,
  formatCaregiverLoadEngineObservation,
  type ProcessCaregiverLoadEngineParams,
} from "./process";
export {
  saveLoadSignals,
  getLoadSignals,
  saveLoadScores,
  getLoadScores,
  saveBurnoutModel,
  getBurnoutModel,
  saveCaregiverProfile,
  getCaregiverProfile,
  persistCaregiverLoadStores,
  resetCaregiverLoadStores,
  persistSessionLoadState,
} from "./stores";
