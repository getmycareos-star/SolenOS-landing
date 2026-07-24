/**
 * MVP Research Validation — cognitive load reduction + retention hypothesis.
 *
 * SolenOS is an external memory layer for care reality, not a productivity tool.
 * SoT: docs/02-product/solenos-mvp-research-validation.md
 */

export {
  RESEARCH_VALIDATION_PURPOSE,
  RESEARCH_RETENTION_HYPOTHESIS,
  RESEARCH_SUCCESS_FEEL,
  RESEARCH_BUILD_NOW,
  RESEARCH_DO_NOT_BUILD_NOW,
  RESEARCH_ENGINEERING_PRIORITY,
  RESEARCH_MVP_MUST_CREATE,
} from "./contract-constants";

export type {
  AttentionLane,
  CompetingAttentionResult,
  AttentionSituation,
  ResearchValidationFeatureEvaluation,
} from "./types";

export { evaluateAgainstResearchValidation } from "./evaluate-feature";
export { prioritizeCompetingAttention, formatCompetingSituationLines } from "./competing-attention";
export { composeMentalLoadCaptureLines } from "./mental-load-capture";
export {
  deriveRetentionProxySignals,
  recordRetentionResearchEvent,
  attachFeedbackToRetentionResearch,
  aggregateWeeklyRetentionCohortMetrics,
  weekKeyFromIso,
  resetRetentionResearchStore,
  getRetentionResearchStore,
  RETENTION_MICRO_PROMPT_STATUS,
} from "./retention-instrumentation";
export type {
  RetentionHypothesisId,
  RetentionProxySignals,
  RetentionResearchEvent,
  RetentionComposeSnapshot,
  WeeklyRetentionCohortMetrics,
} from "./retention-instrumentation";

