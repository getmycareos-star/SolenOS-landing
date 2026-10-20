export {
  ASSUMPTION_REGISTRY_LAYER_IDENTITY,
  ASSUMPTION_REGISTRY_LAYER_ONE_LINE_TRUTH,
  ASSUMPTION_REGISTRY_LAYER_PIPELINE_POSITION,
  ASSUMPTION_REGISTRY_LAYER_FORBIDDEN,
  ASSUMPTION_STATUSES,
  ASSUMPTION_SOURCES,
  DEFAULT_ASSUMPTION_EXPIRATION_DAYS,
  DEFAULT_ASSUMPTION_STALE_DAYS,
  ASSUMPTION_INFERENCE_CONFIDENCE_THRESHOLD,
  ASSUMPTION_INFLUENCE_CAP,
} from "./contract-constants";

export type {
  Assumption,
  AssumptionStatus,
  AssumptionSource,
  AssumptionRegistryPolicy,
  AssumptionRegistryState,
  AssumptionHealth,
  AssumptionInfluenceEnvelope,
  AssumptionInvalidationEvent,
  AssumptionRegistryGuaranteeResult,
  AssumptionRegistryLayerResult,
  AssumptionRegistryLayerPayload,
} from "./types";

export {
  createDefaultAssumptionPolicy,
  createDefaultAssumptionRegistryState,
} from "./defaults";

export {
  getUserAssumptionRegistryState,
  setUserAssumptionRegistryState,
  bindAssumptionRegistryToUser,
  clearUserAssumptionRegistryState,
  resetAssumptionRegistryStore,
  listAllAssumptionRegistryStates,
} from "./persistence";

export {
  canTransitionAssumptionStatus,
  transitionAssumptionStatus,
  isInfluenceableStatus,
} from "./lifecycle";

export {
  mapConfirmedToValidated,
  mapValidatedToConfirmed,
  isConfirmedOrValidated,
  isInfluenceableIncludingConfirmed,
} from "./status-aliases";

export {
  isAssumptionExpired,
  isAssumptionStale,
  applyAssumptionExpiration,
  daysSinceLastCheck,
} from "./expiration";

export {
  createAssumption,
  addAssumption,
  validateAssumption,
  invalidateAssumption,
  invalidateAssumptionsForSituation,
  getAssumptionById,
} from "./store";

export {
  CONTRADICTION_PAIRS,
  detectAssumptionSignalsFromInput,
  detectContradictoryInvalidations,
  detectDocumentAssumptionSignals,
  type ContradictionPair,
  type DetectedAssumptionSignal,
} from "./detectors";

export {
  seedAssumptionsFromCareProfile,
  seedAssumptionsFromSignals,
  invalidateAssumptionsForResolvedSituations,
} from "./seeding";

export {
  getInfluenceableAssumptions,
  collectAssumptionHealth,
  computeAssumptionInfluenceEnvelope,
} from "./influence";

export {
  runAssumptionRegistryGuarantee,
  validateAssumptionRegistryLayerResult,
} from "./guarantee";

export {
  applyAssumptionBehaviorWeighting,
  mergeAssumptionWithModuleWeights,
} from "./weighting";

export {
  processAssumptionRegistryLayer,
  applyAssumptionRegistryBehaviorWeighting,
  applyAssumptionRegistryGovernanceWeighting,
  toAssumptionRegistryLayerPayload,
  formatAssumptionRegistryObservation,
  refreshAssumptionRegistryFromDocuments,
  getAssumptionRegistryStateForUser,
  type ProcessAssumptionRegistryLayerParams,
} from "./apply-registry";

export {
  toAssumptionRegistryView,
  type AssumptionViewItem,
  type AssumptionRegistryView,
} from "./view-model";

/**
 * @deprecated FACADE — Assumptions are BELIEF items (type=assumption).
 * Canonical store: src/lib/solenos-layers/belief
 */
export {
  DEPRECATED_FACADE_NOTICE,
  type BeliefItem,
  createBeliefItem,
  listActiveAssumptions,
  assumptionToBeliefItem,
} from "../solenos-layers";
