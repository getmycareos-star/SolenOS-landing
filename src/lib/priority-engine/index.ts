export {
  PRIORITY_ENGINE_LAYER_IDENTITY,
  PRIORITY_ENGINE_LAYER_ONE_LINE_TRUTH,
  PRIORITY_ENGINE_LAYER_PIPELINE_POSITION,
  PRIORITY_ENGINE_LAYER_FORBIDDEN,
  DEFAULT_PRIORITY_WEIGHTS,
  DEFAULT_TOP_N,
  CONFLICT_SCORE_SIMILARITY_THRESHOLD,
  CONFLICT_MIN_SCORE,
  RISK_SUPPRESSION_FLOOR,
  PRIORITY_DOMAINS,
  HARD_CONSTRAINT_KINDS,
  HIGH_MISSING_INFO_CONFIDENCE_CAP,
} from "./contract-constants";

export type {
  PriorityDomain,
  HardConstraintKind,
  PriorityWeights,
  PriorityVectorComponents,
  PriorityVector,
  PriorityScoreInputs,
  EmotionalAmplificationInput,
  MemoryReinforcementInput,
  RiskPenaltyInput,
  DependencyGraphInput,
  PriorityActionCandidate,
  PriorityConflictFlag,
  AppliedHardConstraint,
  PriorityEngineGuaranteeResult,
  PriorityEngineWeightEnvelope,
  PriorityEngineLayerResult,
  PriorityEngineLayerPayload,
  SituationPriorityContractSnapshot,
} from "./types";

export {
  DEFAULT_PRIORITY_ENGINE_WEIGHTS,
  DEFAULT_PRIORITY_TOP_N,
} from "./defaults";

export { normalize, clampUnit, normalizeBatch, normalizeScore01 } from "./normalize";

export {
  computeDependencyWeight,
  computeEmotionalAmplification,
  computeMemoryReinforcement,
  computeRiskPenalty,
  computePriorityScore,
  applyEmotionalWeightModifiers,
  computeUncertainty,
} from "./score";

export { detectPriorityConflicts } from "./conflict";

export {
  applyHardConstraintFilter,
  type HardConstraintContext,
} from "./constraints";

export { sortPriorityVectors, selectTopN } from "./rank";

export { runPriorityEngineGuarantee, validatePriorityEngineLayerResult } from "./guarantee";

export {
  readPriorityWeightsFromSettings,
  mergePriorityWeightsWithDefaults,
} from "./bridge-settings";

export { derivePriorityCandidates } from "./derive-candidates";

export {
  applyPriorityBehaviorWeightingFromEnvelope,
  mergePriorityWithModuleWeights,
} from "./weighting";

export {
  processPriorityEngineLayer,
  applyPriorityEngineBehaviorWeighting,
  applyPriorityEngineGovernanceWeighting,
  toPriorityEngineLayerPayload,
  formatPriorityEngineObservation,
  type ProcessPriorityEngineLayerParams,
} from "./process";

/**
 * @deprecated FACADE — Situation Priority = PriorityContract.calculate.
 * Canonical: src/lib/solenos-layers/derived/priority-contract.ts
 * computePriority / processPriorityEngineLayer thin-wrap the contract for situations.
 */
export {
  computePriority,
  PriorityContract,
  calculatePriorityContract,
  rankByPriorityContract,
  calculateAndRankSituations,
  DEPRECATED_FACADE_NOTICE,
  HIGH_MISSING_INFO_CONFIDENCE_CAP as LAYERED_HIGH_MISSING_INFO_CONFIDENCE_CAP,
  PRIORITY_CONTRACT_ONE_LINE,
  RISK_WEIGHT,
  TIME_URGENCY,
  COMPLETION_FACTOR,
} from "../solenos-layers";

export {
  rankSituationsViaPriorityContract,
  scoreSituationViaPriorityContract,
  trackedSituationsToPriorityInputs,
  horizonToTimeUrgency,
} from "./situation-contract";
