/**
 * LAYER 2: BELIEF — unified uncertainty model.
 * Merges Assumption Registry + Missing Information Queue into BeliefItem.
 */

export {
  createBeliefItem,
  mapAssumptionStatusToBelief,
  mapBeliefStatusToAssumption,
  mapMissingInfoStatusToBelief,
  mapBeliefStatusToMissingInfo,
  assumptionToBeliefItem,
  missingInfoToBeliefItem,
} from "./map";

export {
  resetBeliefStore,
  getBeliefSnapshot,
  setBeliefItems,
  listBeliefs,
  upsertBelief,
  addBelief,
  updateBeliefStatus,
  listActiveAssumptions,
  listActiveMissingInformation,
  hasHighImportanceMissingInformation,
  countHighImportanceMissingInformation,
} from "./store";

export {
  computeBeliefInfluence,
  type BeliefInfluenceEnvelope,
  type ConflictBeliefInput,
} from "./influence";
