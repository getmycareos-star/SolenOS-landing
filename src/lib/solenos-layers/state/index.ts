/**
 * LAYER 1: STATE — objective current reality.
 * Contains ONLY: Situation (status/priority/summary), Demand action state,
 * optional legacy actionStatus, document refs.
 */

export {
  mapLifecycleToStateStatus,
  mapStateStatusToLifecycle,
  toStateSituation,
  isOperationallyActive,
} from "./map";

export {
  resetStateStore,
  listStateSituations,
  listStateSituationsForUser,
  listActiveStateSituations,
  upsertStateSituation,
  replaceStateSituations,
  getStateSituation,
  attachDocumentRefs,
  getStateSnapshot,
  listAllStateSituations,
} from "./store";

/** Demand = STATE action objects attached to situations (thin store facade). */
export {
  resetDemandStore,
  listDemands,
  listActiveDemands,
  getDemand,
  upsertDemand,
  mergeGeneratedDemands,
  replaceDemands,
  transitionDemandStatus,
  canTransitionDemand,
} from "../../demand-engine/store";
