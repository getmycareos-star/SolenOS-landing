export {
  MISSING_INFORMATION_QUEUE_LAYER_IDENTITY,
  MISSING_INFORMATION_QUEUE_LAYER_ONE_LINE_TRUTH,
  MISSING_INFORMATION_QUEUE_LAYER_PIPELINE_POSITION,
  MISSING_INFORMATION_QUEUE_LAYER_FORBIDDEN,
  MISSING_INFORMATION_STATUSES,
  MISSING_INFORMATION_SOURCES,
  MISSING_INFORMATION_IMPORTANCE,
  DEFAULT_MISSING_INFORMATION_EXPIRATION_DAYS,
  MISSING_INFORMATION_CONFIDENCE_PENALTY_CAP,
  MISSING_INFORMATION_UNCERTAINTY_PER_HIGH,
  CRITICAL_GAP_WARNING,
} from "./contract-constants";

export type {
  MissingInformationItem,
  MissingInformationStatus,
  MissingInformationSource,
  MissingInformationImportance,
  MissingInformationQueuePolicy,
  MissingInformationQueueState,
  MissingInformationHealth,
  MissingInformationInfluenceEnvelope,
  MissingInformationResolutionEvent,
  MissingInformationQueueGuaranteeResult,
  MissingInformationQueueLayerResult,
  MissingInformationQueueLayerPayload,
} from "./types";

export {
  createDefaultMissingInformationPolicy,
  createDefaultMissingInformationQueueState,
} from "./defaults";

export {
  getUserMissingInformationQueueState,
  setUserMissingInformationQueueState,
  bindMissingInformationQueueToUser,
  clearUserMissingInformationQueueState,
  resetMissingInformationQueueStore,
  listAllMissingInformationQueueStates,
} from "./persistence";

export {
  canTransitionMissingInformationStatus,
  transitionMissingInformationStatus,
  isOpenStatus,
} from "./lifecycle";

export {
  isMissingInformationExpired,
  applyMissingInformationExpiration,
} from "./expiration";

export {
  isKnowledgeGapQuestion,
  createMissingInformationItem,
  addMissingInformationItem,
  resolveMissingInformationItem,
  getMissingInformationById,
  getOpenItemsForSituation,
} from "./store";

export { classifyMissingInformationImportance } from "./importance";

export {
  detectMissingFromReasoning,
  detectMissingFromDocuments,
  detectMissingFromMemory,
  detectMissingFromUserInput,
  type DetectedMissingInformationSignal,
} from "./generators";

export {
  RESOLUTION_PAIRS,
  autoResolveMissingInformation,
  formatNeedsNextPhrase,
} from "./resolution";

export { seedMissingInformationFromSignals } from "./seeding";

export {
  getOpenMissingInformationItems,
  collectMissingInformationHealth,
  computeMissingInformationInfluenceEnvelope,
} from "./influence";

export {
  runMissingInformationQueueGuarantee,
  validateMissingInformationQueueLayerResult,
} from "./guarantee";

export {
  applyMissingInformationBehaviorWeighting,
  mergeMissingInformationWithModuleWeights,
} from "./weighting";

export {
  processMissingInformationQueueLayer,
  applyMissingInformationQueueBehaviorWeighting,
  applyMissingInformationQueueGovernanceWeighting,
  toMissingInformationQueueLayerPayload,
  formatMissingInformationQueueObservation,
  refreshMissingInformationQueueFromDocuments,
  getMissingInformationQueueStateForUser,
  type ProcessMissingInformationQueueLayerParams,
} from "./process";

export {
  toMissingInformationQueueView,
  type MissingInformationViewItem,
  type MissingInformationQueueView,
} from "./view-model";

/**
 * @deprecated FACADE — Missing information is BELIEF (type=missing_information).
 * Canonical store: src/lib/solenos-layers/belief
 */
export {
  DEPRECATED_FACADE_NOTICE,
  type BeliefItem,
  createBeliefItem,
  listActiveMissingInformation,
  hasHighImportanceMissingInformation,
  missingInfoToBeliefItem,
  HIGH_MISSING_INFO_CONFIDENCE_CAP,
} from "../solenos-layers";
