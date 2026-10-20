/**
 * Family Intelligence — strategic facade unifying SolenOS continuity assets.
 *
 * Core principle: SolenOS IS a continuity intelligence system.
 * Primary asset: accumulated family intelligence (compounds over time).
 * Evaluation: "Does this increase SolenOS' understanding of the family
 * responsibility system over time?"
 *
 * Bridge/facade pattern — does NOT rebuild care-profile, responsibility-graph,
 * decision-history, delegation-layer, crisis-prevention, or confidence-layer.
 */

export {
  FAMILY_INTELLIGENCE_IDENTITY,
  FAMILY_INTELLIGENCE_PRIMARY_ASSET,
  FAMILY_INTELLIGENCE_EVALUATION_QUESTION,
  FAMILY_INTELLIGENCE_LONG_TERM_VISION,
  FAMILY_INTELLIGENCE_PRODUCT_RULE,
  FAMILY_INTELLIGENCE_ASSETS,
  FAMILY_INTELLIGENCE_PIPELINE_POSITION,
  TRUST_MECHANISMS,
} from "./contract-constants";

export type {
  FamilyPerson,
  Relationship,
  CareEvent,
  Pattern,
  FamilyMemory,
  FamilyMemoryPersistenceAdapter,
} from "./family-memory";
export {
  createEmptyFamilyMemory,
  getFamilyMemory,
  upsertFamilyPerson,
  upsertRelationship,
  appendCareEvent,
  upsertPattern,
  bridgeFromCareProfile,
  bridgeFromMemoryInfluence,
  setFamilyMemoryPersistence,
  persistFamilyMemory,
  resetFamilyMemoryStore,
} from "./family-memory";

export type {
  ResponsibilityRelationship,
  CareGraph,
  CareGraphPersistenceAdapter,
} from "./care-graph";
export {
  getCareGraph,
  upsertCareGraphEdge,
  bridgeFromResponsibilityGraph,
  personsToFamilyNodes,
  responsibilitiesToEdges,
  setCareGraphPersistence,
  persistCareGraph,
  resetCareGraphStore,
} from "./care-graph";

export type {
  StrategicDecisionRecord,
  DecisionHistory,
  DecisionHistoryPersistenceAdapter,
} from "./decision-history";
export {
  recordDecisionOutcome,
  listDecisionHistory,
  bridgeFromExplanationDecision,
  updateDecisionOutcome,
  setDecisionHistoryPersistence,
  persistDecisionHistory,
  resetStrategicDecisionStore,
} from "./decision-history";

export type {
  DelegationNetworkRecord,
  DelegationNetwork,
  DelegationNetworkPersistenceAdapter,
} from "./delegation-network";
export {
  recordDelegationEvent,
  listDelegationNetwork,
  bridgeFromDelegationSuggestions,
  overloadConcentration,
  setDelegationNetworkPersistence,
  persistDelegationNetwork,
  resetDelegationNetworkStore,
} from "./delegation-network";

export type {
  CrisisSignal,
  CrisisPredictionPersistenceAdapter,
} from "./crisis-prediction";
export {
  recordCrisisSignals,
  listCrisisSignals,
  latestCrisisSignals,
  bridgeFromCrisisRisks,
  setCrisisPredictionPersistence,
  persistCrisisSignals,
  resetCrisisPredictionStore,
} from "./crisis-prediction";

export type { ConfidenceState } from "./confidence-state";
export {
  recordConfidenceState,
  getLatestConfidence,
  listConfidenceHistory,
  bridgeFromConfidenceLayer,
  resetConfidenceStateStore,
} from "./confidence-state";

export type {
  TrustMechanism,
  TrustHookResult,
  TrustMechanismsSnapshot,
} from "./trust-mechanisms";
export {
  buildRememberHook,
  buildExplainHook,
  buildReduceGuiltHook,
  buildPreventMistakesHook,
  buildTrustMechanismsSnapshot,
} from "./trust-mechanisms";

export type {
  FamilyIntelligenceSnapshot,
  CompoundAnalyzeInteractionInput,
} from "./compound";
export {
  compoundAnalyzeInteraction,
  buildFamilyIntelligenceSnapshot,
} from "./compound";

export { resetAllFamilyIntelligenceStores } from "./stores";
