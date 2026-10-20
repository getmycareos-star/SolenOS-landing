export {
  CONFLICT_DETECTION_LAYER_IDENTITY,
  CONFLICT_DETECTION_LAYER_ONE_LINE_TRUTH,
  CONFLICT_DETECTION_LAYER_PIPELINE_POSITION,
  CONFLICT_DETECTION_LAYER_FORBIDDEN,
  CONFLICT_TYPES,
  CONFLICT_SEVERITIES,
  CONFLICT_STATUSES,
  CONFLICT_SEVERITY_CONFIDENCE_REDUCTION,
  CONFLICT_CONFIDENCE_PENALTY_CAP,
  CONFLICT_LOAD_PER_OPEN,
  CONFLICT_LOAD_PER_CRITICAL,
  CONFLICT_LOAD_CAP,
  CONFLICT_CLARIFICATION_HEADLINE,
} from "./contract-constants";

export type {
  ConflictType,
  ConflictSeverity,
  ConflictStatus,
  Conflict,
  ConflictRegistry,
  FactCandidate,
  ConflictClarification,
  ConflictDetectionEnvelope,
  ConflictSourceLayer,
  RuntimeConflictFlag,
  ConflictDetectionResult,
  ConflictDetectionLayerPayload,
} from "./types";

export {
  createEmptyConflictRegistry,
  resetConflictRegistryStore,
  getConflictRegistry,
  setConflictRegistry,
  registerConflicts,
  transitionConflictStatus,
  listOpenConflicts,
} from "./registry";

export {
  detectConflicts,
  detectConflictsFromText,
  extractFactCandidates,
} from "./detect";

export {
  buildClarificationForConflict,
  selectPrimaryClarification,
} from "./clarification";

export {
  computeOpenConflictConfidencePenalty,
  hasCriticalMedicalRestriction,
  hasHighImpactOpenConflicts,
  computeConflictLoadContribution,
  computeConflictDetectionEnvelope,
  applyConflictBeliefConfidenceReduction,
} from "./influence";

export {
  resolveConflictFromUserResponse,
  ignoreConflict,
} from "./resolve";

export {
  processConflictDetection,
  processConflictDetectionLayer,
  toConflictDetectionLayerPayload,
  formatConflictDetectionObservation,
  severityAtLeast,
  type ProcessConflictDetectionLayerParams,
} from "./process";

export {
  toConflictClarificationView,
  type ConflictClarificationView,
} from "./view-model";
