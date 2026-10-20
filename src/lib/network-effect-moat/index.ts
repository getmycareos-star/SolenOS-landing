export {
  NETWORK_EFFECT_MOAT_IDENTITY,
  COMPOUNDING_ASSET_TYPES,
  NON_COMPOUNDING_TYPES,
  INTERACTION_OUTCOME_TYPES,
  ENRICHMENT_ACTION_TYPES,
  MATURITY_STAGES,
  MATURITY_MESSAGES,
} from "./contract-constants";

export type {
  CompoundingAssetType,
  NonCompoundingType,
  InteractionOutcomeType,
  EnrichmentActionType,
  MaturityStage,
  EntityMatch,
  EventMatch,
  ResolvedUncertainty,
  EnrichmentAction,
  InteractionOutcome,
  CompoundingMetrics,
  MoatStrength,
  NetworkEffectMoatResult,
  MoatStore,
} from "./types";

export { matchEntities, matchEvents, extractEntitiesFromEvents } from "./entity-matching";

export {
  attemptUncertaintyResolution,
  buildEnrichmentActions,
  countNewRelationships,
} from "./enrichment";

export {
  deriveInteractionOutcomes,
  assertContextGrew,
  countIsolatedRecords,
} from "./interaction-outcomes";

export { computeCompoundingMetrics, describeCompoundingAssets } from "./compounding-metrics";

export {
  deriveMaturityStage,
  maturityMessage,
  computeMoatStrength,
  assertMaturityStagesDefined,
} from "./maturity";

export { getMoatStore, updateMoatStore, resetMoatStore, listResolvedUncertainties } from "./store";

export { processNetworkEffectMoat } from "./pipeline";
