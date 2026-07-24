/**
 * Re-export persistence adapter types + no-op stubs for Postgres wiring.
 */

export type { FamilyMemoryPersistenceAdapter } from "../family-memory";
export type { CareGraphPersistenceAdapter } from "../care-graph";
export type { DecisionHistoryPersistenceAdapter } from "../decision-history";
export type { DelegationNetworkPersistenceAdapter } from "../delegation-network";
export type { CrisisPredictionPersistenceAdapter } from "../crisis-prediction";

export {
  setFamilyMemoryPersistence,
  persistFamilyMemory,
  resetFamilyMemoryStore,
} from "../family-memory";
export {
  setCareGraphPersistence,
  persistCareGraph,
  resetCareGraphStore,
} from "../care-graph";
export {
  setDecisionHistoryPersistence,
  persistDecisionHistory,
  resetStrategicDecisionStore,
} from "../decision-history";
export {
  setDelegationNetworkPersistence,
  persistDelegationNetwork,
  resetDelegationNetworkStore,
} from "../delegation-network";
export {
  setCrisisPredictionPersistence,
  persistCrisisSignals,
  resetCrisisPredictionStore,
} from "../crisis-prediction";
export { resetConfidenceStateStore } from "../confidence-state";

import { resetFamilyMemoryStore } from "../family-memory";
import { resetCareGraphStore } from "../care-graph";
import { resetStrategicDecisionStore } from "../decision-history";
import { resetDelegationNetworkStore } from "../delegation-network";
import { resetCrisisPredictionStore } from "../crisis-prediction";
import { resetConfidenceStateStore } from "../confidence-state";

/** Reset all family-intelligence in-memory stores (tests / verify). */
export function resetAllFamilyIntelligenceStores(scopeId?: string): void {
  resetFamilyMemoryStore(scopeId);
  resetCareGraphStore(scopeId);
  resetStrategicDecisionStore(scopeId);
  resetDelegationNetworkStore(scopeId);
  resetCrisisPredictionStore(scopeId);
  resetConfidenceStateStore(scopeId);
}
