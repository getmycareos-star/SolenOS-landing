export {
  SITUATION_RISK_REGISTER_LAYER_IDENTITY,
  SITUATION_RISK_REGISTER_LAYER_ONE_LINE_TRUTH,
  SITUATION_RISK_REGISTER_LAYER_PIPELINE_POSITION,
  SITUATION_RISK_REGISTER_LAYER_FORBIDDEN,
  BASE_RISK_LEVELS,
  OVERLOAD_RISK_THRESHOLD,
  OVERLAP_PENALTY_MIN_PCT,
  OVERLAP_PENALTY_MAX_PCT,
  UNCERTAINTY_PENALTY_COEFFICIENT,
  DEPENDENCY_MULTIPLIER_PCT,
  ASSUMPTION_INSTABILITY_VOLATILITY_WEIGHT,
  SYSTEM_RISK_EXPOSURE_PRIORITY_WEIGHT,
  OVERLOAD_PRIORITY_TOP_N,
  SITUATION_RISK_DRIVER_WEIGHTS,
} from "./contract-constants";

export type {
  BaseRiskLevel,
  SituationRiskDrivers,
  SituationRisk,
  SystemRiskState,
  RiskCluster,
  OverloadSimplificationSignals,
  SystemRiskPriorityEnvelope,
  SituationRiskRegisterGuaranteeResult,
  SituationRiskRegisterLayerResult,
  SituationRiskRegisterLayerPayload,
} from "./types";

export {
  clamp0100,
  clamp01,
  emptySystemRiskState,
  emptyOverloadSignals,
  emptyPriorityEnvelope,
} from "./defaults";

export { computeSituationRisk } from "./compute-situation-risk";

export {
  buildRiskClusters,
  selectDominantRiskCluster,
} from "./cluster";

export {
  computeOverlapPenalty,
  computeUncertaintyPenalty,
  computeDependencyMultiplier,
  aggregateSystemRisk,
  type AggregationBreakdown,
} from "./aggregate";

export {
  detectOverload,
  buildSystemRiskPriorityEnvelope,
} from "./overload";

export {
  applySystemRiskToPriorityScore,
  applySystemRiskToPriorityVectors,
  resolvePriorityTopNWithOverload,
} from "./bridge-priority";

export {
  applyOverloadSafetySimplification,
  applySituationRiskGovernanceWeighting,
} from "./bridge-safety";

export {
  runSituationRiskRegisterGuarantee,
  validateSituationRiskRegisterLayerResult,
} from "./guarantee";

export {
  applySituationRiskBehaviorWeighting,
  mergeSituationRiskWithModuleWeights,
} from "./weighting";

export {
  processSituationRiskRegisterLayer,
  applySituationRiskRegisterBehaviorWeighting,
  applySituationRiskRegisterGovernanceWeighting,
  applySituationRiskRegisterSafetySimplification,
  toSituationRiskRegisterLayerPayload,
  formatSituationRiskRegisterObservation,
  type ProcessSituationRiskRegisterLayerParams,
} from "./process";

/**
 * @deprecated FACADE — Risk is a pure derived function, not a persistent register.
 * Canonical: src/lib/solenos-layers/derived/computeRisk
 */
export { computeRisk, DEPRECATED_FACADE_NOTICE } from "../solenos-layers";
