export {
  SYSTEM_HEALTH_LAYER_IDENTITY,
  SYSTEM_HEALTH_LAYER_ONE_LINE_TRUTH,
  SYSTEM_HEALTH_LAYER_PIPELINE_POSITION,
  SYSTEM_HEALTH_LAYER_FORBIDDEN,
  SYSTEM_HEALTH_WEIGHTS,
  SYSTEM_HEALTH_BANDS,
  SYSTEM_HEALTH_BAND_LABELS,
  HEALTH_ALERT_SEVERITIES,
  SYSTEM_HEALTH_DOCUMENT_CONFIDENCE_THRESHOLD,
  SITUATION_LOAD_HIGH_THRESHOLD,
  REJECTION_DRIFT_RATIO_THRESHOLD,
  REJECTION_DRIFT_MIN_SAMPLES,
  UNREAD_CRITICAL_DOCUMENT_PENALTY,
  CLARIFICATION_REQUEST_PREFIX,
  HEALTH_UNCERTAINTY_MARKER,
} from "./contract-constants";

export type {
  HealthBand,
  HealthAlertSeverity,
  SystemHealthWeights,
  ContextHealth,
  MemoryHealth,
  SituationHealth,
  ContradictionHealth,
  DocumentHealth,
  DecisionHealth,
  AssumptionHealth,
  MissingInformationHealth,
  SystemHealth,
  HealthAlert,
  DimensionScores,
  PreRecommendationGate,
  SystemHealthGuaranteeResult,
  SystemHealthLayerResult,
  SystemHealthLayerPayload,
  DecisionFeedbackSignals,
  SituationSnapshotSignals,
} from "./types";

export {
  scoreContextQuality,
  scoreMemoryQuality,
  scoreSituationCoverage,
  scoreContradictionHealth,
  scoreDocumentHealth,
  scoreDecisionHealth,
  computeDimensionScores,
  computeOverallHealthScore,
  labelHealthBand,
  buildSystemHealth,
} from "./score";

export {
  collectContextHealth,
  collectMemoryHealth,
  collectSituationHealth,
  collectContradictionHealth,
  collectDocumentHealth,
  collectDecisionHealth,
  collectAssumptionHealth,
  collectMissingInformationHealth,
} from "./collectors";

export {
  generateHealthAlerts,
  buildIssueBullets,
  formatUserFacingSummary,
} from "./alerts";

export { buildPreRecommendationGate } from "./gate";

export { runSystemHealthGuarantee, validateSystemHealthLayerResult } from "./guarantee";

export {
  toSystemHealthSidebarView,
  toUiRuntimeSystemHealthView,
  emptySystemHealthParts,
  type SystemHealthSidebarView,
} from "./view-model";

export {
  processSystemHealthLayer,
  applySystemHealthGovernanceWeighting,
  toSystemHealthLayerPayload,
  type ProcessSystemHealthLayerParams,
} from "./process";

/**
 * @deprecated FACADE — Health is an EXPLANATION derived summary, not an active engine.
 * Autonomy gating: computeAutonomyGate(STATE, BELIEF) — derived-function behavior.
 * Canonical: src/lib/solenos-layers/derived/computeHealthSummary
 */
export {
  computeHealthSummary,
  computeAutonomyGate,
  viewHealthSummary,
  DEPRECATED_FACADE_NOTICE,
} from "../solenos-layers";
