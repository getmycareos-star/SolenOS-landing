export {
  CAPACITY_SELF_IDENTITY,
  CAPACITY_MATCHED_NOTE,
  VALUES_CAPTURE_ROADMAP,
  DEFAULT_CAREGIVER_ID,
  CONTEXT_LABELS,
} from "./contract-constants";

export type {
  ContextType,
  CapacityLevel,
  ItemSubject,
  ItemStatus,
  CareItem,
  BatchViewGroup,
  BatchViewResult,
  CapacityMatchedSuggestion,
  CapacitySessionState,
  ResolvedItemRecord,
  CaregiverSelfProfileData,
  CaregiverSelfProfileRecord,
  FactualReflection,
  CapacitySelfSessionResult,
} from "./types";

export {
  CONTEXT_TYPES,
  CAPACITY_LEVELS,
  ITEM_SUBJECTS,
  ITEM_STATUSES,
} from "./types";

export { classifyContextType, classifyEffortScore } from "./classify-context";

export {
  buildCareItemsFromInput,
  buildCareItemsFromDescriptions,
  prioritizedToCareItem,
  mergeOpenItems,
  topPriorityItem,
} from "./items/build-care-items";

export { buildBatchView } from "./modules/context-batching";
export { buildCapacityMatchedSuggestion } from "./modules/capacity-suggestions";
export { generateFactualReflection } from "./modules/factual-reflection";

export {
  getOrCreateCaregiverSelfProfile,
  setSessionCapacity,
  addResolvedItem,
  resetCaregiverSelfProfileStore,
} from "./caregiver-profile/store";

export { splitInputBySubject } from "./caregiver-profile/detect-self";
export { ingestCaregiverSelfEntry } from "./caregiver-profile/ingest-self";
export { tryLoadCaregiverSelfProfile, trySaveCaregiverSelfProfile } from "./caregiver-profile/postgres-store";

export {
  processCapacitySelfSession,
  setCaregiverCapacity,
  resolveCareItem,
  type ProcessCapacitySelfSessionParams,
} from "./process-session";
