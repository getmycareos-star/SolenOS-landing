/**
 * TIME WEIGHTING MODEL — pure derived computation.
 * No persistent engine. Feeds Priority Contract / Time Engine temporal urgency.
 */

export {
  TIME_WEIGHTING_IDENTITY,
  TIME_WEIGHTING_ONE_LINE_TRUTH,
  TIME_WEIGHTING_PIPELINE_POSITION,
  TIME_WEIGHTING_FORBIDDEN,
  TIME_CURVE_TYPES,
  CURVE_K_DEFAULTS,
  CURVE_K_RANGES,
  SAFETY_STEP_FLOOR,
  SAFETY_STEP_MAX,
  DEFAULT_THRESHOLDS_HOURS,
  CURVE_DEFAULT_THRESHOLDS,
  MULTI_SITUATION_ELEVATION,
} from "./contract-constants";

export type {
  TimeCurveType,
  TimeThresholds,
  ThresholdZone,
  CurveKParams,
  CurveClassificationSignals,
  CurveClassificationResult,
  RiskOverTimeResult,
  CurvePrioritySignals,
  CurveDefaultKey,
} from "./types";

export {
  resolveCurveK,
  pressureHoursFromRemaining,
  normalizeTau,
  acuteMedicalCurve,
  medicationDependentCurve,
  chronicCareCurve,
  socialCoordinationCurve,
  safetyCriticalStepCurve,
  evaluateTimeCurve,
} from "./curves";

export { classifyTimeCurve } from "./classify";

export {
  defaultThresholds,
  thresholdsForCurve,
  normalizeThresholds,
  thresholdZone,
  isPastCritical,
  isInWarningZone,
  isSafeWindow,
} from "./thresholds";

export {
  computeRiskOverTime,
  curveZoneToTimeUrgency,
  elevateMultiSituationRisk,
  estimateHumanDelayBufferHours,
} from "./risk-over-time";

export {
  linearTimeDecayFactor,
  computeCurveTimeDecayFactor,
  resolvePriorityTimeSignals,
} from "./priority-bridge";
