export {
  RESOLUTION_ENGINE_LAYER_IDENTITY,
  RESOLUTION_ENGINE_LAYER_ONE_LINE_TRUTH,
  RESOLUTION_ENGINE_LAYER_PIPELINE_POSITION,
  RESOLUTION_ENGINE_LAYER_FORBIDDEN,
  SITUATION_LIFECYCLE_STATUSES,
  RESOLUTION_EVIDENCE_KINDS,
  FORBIDDEN_RESOLUTION_TRIGGERS,
  DEFAULT_RETENTION_DAYS,
  REEVALUATION_MAX_AGE_MS,
} from "./contract-constants";

export type {
  SituationStatus,
  ResolutionEvidenceKind,
  ForbiddenResolutionTrigger,
  ResolutionEvidence,
  LifecycleHistoryEntry,
  TrackedSituation,
  ArchiveEligibilityChecks,
  ResolveSituationResult,
  ArchiveSituationResult,
  SupersedeSituationResult,
  ResolutionSignalDetection,
  ResolutionEngineGuaranteeResult,
  ResolutionEngineLayerPayload,
  ResolutionEngineLayerResult,
} from "./types";

export { createEmptyTrackedSituation, createSituationId, nowIso } from "./defaults";

export {
  validateResolutionEvidence,
  assertNotForbiddenTrigger,
  isValidEvidenceKind,
} from "./evidence";

export {
  canTransition,
  validateLifecycleTransition,
  REQUIRED_STATE_FLOW,
} from "./lifecycle";

export {
  resolveSituation,
  archiveSituation,
  createNewSituationFromSupersede,
  buildArchiveEligibility,
} from "./resolve";

/** Spec alias — ACTIVE → RESOLVED with evidence. Do not resurrect. */
export { resolveSituation as markResolved } from "./resolve";

/** Spec alias — RESOLVED → ARCHIVED when eligibility passes. */
export { archiveSituation as archiveResolved } from "./resolve";

export {
  getActiveSituations,
  getResolvedSituations,
  getArchivedSituations,
  filterSituationsForPriority,
  filterSituationsForRisk,
  hasActiveSituations,
  countByStatus,
} from "./filters";

export {
  runResolutionEngineGuarantee,
  validateResolutionEngineLayerResult,
} from "./guarantee";

export { evaluateResolutionSignals } from "./evaluate-signals";

export {
  resetResolutionStoreForTests,
  listSituationsForSession,
  listSituationsForUser,
  upsertSituation,
  replaceSessionSituations,
  ensureActiveSituation,
  getSituationById,
  listAllTrackedSituations,
  appendPreservedRefs,
} from "./persistence";

export {
  mapUiStatusToLifecycle,
  mapLifecycleToUiStatus,
  uiStatusIsOperationallyActive,
} from "./ui-bridge";

export {
  processResolutionEngineLayer,
  toResolutionEngineLayerPayload,
  formatResolutionEngineObservation,
  type ProcessResolutionEngineLayerParams,
} from "./process";

export {
  upsertTrackedSituationFromCareInput,
  pauseActiveTrackedSituationsForCareKey,
  retireActiveTrackedSituationsForSupersede,
  hydrateTrackedSituationsFromCareContext,
  trackedSituationToUiSituation,
  listActiveUiSituationsForCareKey,
} from "./care-context-sync";
export type { CareContextSyncResult } from "./care-context-sync";

/**
 * @deprecated FACADE — Situation truth lives in STATE (solenos-layers/state).
 * Lifecycle transitions remain here as STATE update helpers; sync via syncTrackedSituationsToState.
 */
export {
  toStateSituation,
  syncTrackedSituationsToState,
  DEPRECATED_FACADE_NOTICE,
} from "../solenos-layers";
