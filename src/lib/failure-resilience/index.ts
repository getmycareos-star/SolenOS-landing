export {
  FAILURE_RESILIENCE_IDENTITY,
  FAILURE_OUTCOMES,
  FAILURE_CATEGORIES,
  PROCESSING_STATUSES,
  VERIFICATION_STATUSES,
  RELATIONSHIP_STATUSES,
  MAX_CLARIFICATION_QUESTIONS,
  MAX_RETRY_ATTEMPTS,
  RETRY_BACKOFF_MS,
} from "./contract-constants";

export type {
  FailureCategory,
  FailureOutcome,
  ProcessingStatus,
  VerificationStatus,
  RelationshipStatus,
  ExtractionConfidence,
  FailureRecord,
  PendingProcessing,
  FailureResilienceResult,
} from "./types";

export {
  buildConfidenceForEvent,
  buildConfidenceFromDare,
} from "./confidence-model";

export {
  classifyFailures,
  countOutcomes,
  deriveProcessingStatus,
} from "./classify-failures";

export {
  detectGraphLinkingFailures,
  markEventRelationshipStatus,
} from "./graph-linking";

export {
  enqueuePendingProcessing,
  getPendingProcessing,
  getRetryablePending,
  markRetryAttempt,
  completePendingProcessing,
  resetFailureResilienceStore,
} from "./processing-queue";

export {
  RECOVERY_ACTIONS,
  deriveRecoveryActions,
  recoveryActionLabel,
  type RecoveryAction,
} from "./recovery";

export {
  processFailureResilience,
  applyFailureMarkersToEvents,
  tagEventsWithProcessingStatus,
} from "./pipeline";
