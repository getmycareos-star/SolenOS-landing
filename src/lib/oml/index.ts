export type {
  OutcomeTrend,
  OutcomeMetricId,
  CognitiveLoadReductionMetric,
  TimeToUnderstandingMetric,
  ChangeRecognitionLatencyMetric,
  ClarificationLoadMetric,
  TimelineReconstructionAccuracyMetric,
  CaregiverCognitiveLoadScoreMetric,
  DecisionSupportImpactMetric,
  OutcomeMetricsSnapshot,
  OutcomeMetricDelta,
  OutcomeMeasurementResult,
  OMLSession,
  OMLState,
  TimelineCorrection,
  ClarificationRecord,
  DecisionSignal,
  CaregiverFeedbackPrompt,
  CaregiverFeedbackResponse,
  FeedbackCalibrationResult,
  EngineMetricDeclaration,
} from "./types";
export { OML_PRINCIPLE } from "./types";

export {
  ENGINE_METRIC_MAP,
  metricsForEngine,
  enginesForMetric,
  validateEngineHasMetrics,
} from "./engine-metric-map";

export {
  computeCognitiveLoadReduction,
  computeTimeToUnderstanding,
  computeChangeRecognitionLatency,
  computeClarificationLoad,
  computeTimelineReconstructionAccuracy,
  computeCaregiverCognitiveLoadScore,
  computeDecisionSupportImpact,
  computeOutcomeSnapshot,
  classifySessionQuestion,
} from "./compute-metrics";

export {
  computeMetricDeltas,
  computeOutcomeTrend,
  buildOutcomeMeasurement,
  formatOutcomeMeasurement,
} from "./compute-snapshot";

export {
  createOMLSession,
  recordSessionQuestion,
  recordSessionInteraction,
  recordReviewTime,
  recordClarityAchieved,
  closeSession,
} from "./session-tracking";

export {
  FEEDBACK_PROMPTS,
  createFeedbackPrompt,
  processCaregiverFeedback,
  shouldPromptForFeedback,
} from "./caregiver-feedback";

export {
  createEmptyOMLState,
  emitOutcomeMeasurement,
  updateCareContextWithOML,
  recordDecisionSignal,
  recordClarification,
} from "./integrate-context";

export type { CareContextWithOML } from "./integrate-context";
