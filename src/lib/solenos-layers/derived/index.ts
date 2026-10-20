/**
 * DERIVED — pure functions over STATE + BELIEF.
 * NOT ALLOWED as independent/persistent systems:
 * Risk Engine, Priority Engine, Health Engine, Caregiver Load Engine.
 * Demand pressureScore and Caregiver Load are computed, never persisted as engines.
 */

export { computeRisk } from "./compute-risk";
export {
  computePriority,
  buildPriorityContractInputs,
  type ComputePriorityParams,
  type PriorityDemandInput,
  type SituationPrioritySignal,
} from "./compute-priority";
export {
  PriorityContract,
  calculatePriorityContract,
  rankByPriorityContract,
  calculateAndRankSituations,
  computeTimeDecayFactor,
  formatPriorityExplanation,
  riskLevelFromStatePriority,
  RISK_WEIGHT,
  TIME_URGENCY,
  COMPLETION_FACTOR,
  UNCERTAINTY_FIELD_COEFFICIENT,
  DEPENDENCY_SITUATION_COEFFICIENT,
  PRIORITY_CONTRACT_ONE_LINE,
  type PriorityContractInput,
  type PriorityContractResult,
  type PriorityContractRankResult,
  type PriorityComponentBreakdown,
  type RiskLevel,
  type TimeUrgencyKey,
  type CompletionLevel,
} from "./priority-contract";

/** Re-export TIME WEIGHTING helpers used by Priority Contract consumers. */
export {
  classifyTimeCurve,
  computeRiskOverTime,
  computeCurveTimeDecayFactor,
  type TimeCurveType,
  type TimeThresholds,
} from "../../time-weighting";
export {
  computeHealthSummary,
  computeAutonomyGate,
} from "./compute-health";
export {
  computeCaregiverLoad,
  classifyLoadState,
  surfaceLimitForState,
  normalizeLoadScore,
  computeRawLoadScore,
  type CaregiverLoad,
  type CaregiverLoadInputs,
  type CaregiverLoadState,
} from "./compute-caregiver-load";
export {
  computeEmotionalLoadSignal,
  computeStressIndicators,
  computeBurnoutProbability,
  classifyCognitiveFatigue,
  type EmotionalLoadSignal,
  type EmotionalLoadSignalInputs,
  type CognitiveFatigueLevel,
} from "./compute-emotional-load";
export {
  computePressureScore,
  withPressureScore,
  clampScore100,
  rankDemandsByPressure,
  selectTopPressureDemands,
  buildDemandEngineOutput,
} from "./compute-demand-pressure";

export {
  evaluateFailSafeTriggers,
  buildDecisionConfidence,
  type DecisionConfidence,
  type FailSafeModeInput,
  type FailSafeTriggerHit,
  type FailSafeTriggerKind,
  type ClarificationModeOutput,
  FAIL_SAFE_MODE_PIPELINE_POSITION,
  FAIL_SAFE_CLARIFY_ACTION_ID,
} from "./fail-safe";
export {
  computeConfidenceState,
  type ConfidenceState,
  type ComputeConfidenceInputs,
} from "./compute-confidence";
export {
  computeCrisisRisks,
  type CrisisRisk,
  type CrisisCategory,
  type ComputeCrisisRisksInputs,
} from "./compute-crisis-risks";
export {
  computeDelegationSuggestions,
  type DelegationSuggestion,
  type ComputeDelegationInputs,
} from "./compute-delegation";
