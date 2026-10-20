export {
  TIME_ENGINE_LAYER_IDENTITY,
  TIME_ENGINE_LAYER_ONE_LINE_TRUTH,
  TIME_ENGINE_LAYER_PIPELINE_POSITION,
  TIME_ENGINE_LAYER_FORBIDDEN,
  HORIZON_HOURS,
  URGENCY_DECAY_LAMBDA,
  HORIZON_URGENCY_BASE,
  UNSCHEDULED_TEMPORAL_LABEL,
  TIME_HORIZON_KEYS,
  MAX_TIMEZONE_HORIZON_SHIFT_HOURS,
} from "./contract-constants";

export type {
  TimeHorizonKey,
  TimeHorizonModel,
  UrgencyDecayFunction,
  SolenOSTimeEngine,
  TimeInputSignals,
  TimeClassification,
  UnscheduledTemporalState,
  TemporalClassification,
  TemporalPrioritySignal,
  MemoryTimeOverride,
  TimeConflictFlag,
  TimeEngineWeightEnvelope,
  TimeEngineGuaranteeResult,
  TimeEngineLayerResult,
  TimeEngineLayerPayload,
  ReadTimeEngineConfigParams,
} from "./types";

export {
  DEFAULT_TIME_ENGINE,
  DEFAULT_TIME_INPUT_SIGNALS,
  DEFAULT_URGENCY_DECAY_LAMBDA,
  defaultUrgencyDecayFunction,
} from "./defaults";

export { computeUrgencyDecay, applyDecayToUrgency } from "./decay";

export { extractTimeInputSignals, estimateHoursUntil } from "./extract-signals";

export {
  classifyHorizonFromHours,
  classifyTemporalInput,
  buildHorizonBlend,
  type ClassifyHorizonParams,
} from "./classify";

export {
  resolveMemoryTimeOverride,
  resolveTimeConflict,
  computeDependencyBoost,
} from "./memory-override";

export { runTimeEngineGuarantee, validateTimeEngineLayerResult } from "./guarantee";

export { readTimeEngineFromSettings, mergeTimeEngineWithDefaults } from "./bridge-settings";

export {
  computeTimeEngineWeightEnvelope,
  applyTimeEngineBehaviorWeighting as applyTimeEngineBehaviorWeightingFromEnvelope,
  mergeTimeEngineWithModuleWeights,
} from "./weighting";

export {
  processTimeEngineLayer,
  applyTimeEngineBehaviorWeighting,
  applyTimeEngineGovernanceWeighting,
  toTimeEngineLayerPayload,
  formatTimeEngineObservation,
  type ProcessTimeEngineLayerParams,
} from "./process";

/** TIME WEIGHTING MODEL — pure curve math wrapping temporal urgency for Priority. */
export {
  TIME_CURVE_TYPES,
  classifyTimeCurve,
  computeRiskOverTime,
  computeCurveTimeDecayFactor,
  resolvePriorityTimeSignals,
  curveZoneToTimeUrgency,
  thresholdsForCurve,
  thresholdZone,
  type TimeCurveType,
  type TimeThresholds,
  type RiskOverTimeResult,
} from "../time-weighting";
