export {
  MULTI_CAREGIVER_CONTEXT_IDENTITY,
  MULTI_CAREGIVER_DEFINING_PRINCIPLE,
  CAREGIVER_ROLES,
  SOURCE_TYPES,
  MULTI_CAREGIVER_DESIGN_RULES,
  MULTI_CAREGIVER_PRIVACY_RULES,
  DEFAULT_CARE_RECIPIENT_ID,
} from "./contract-constants";

export type {
  CaregiverRole,
  SourceType,
  CaregiverProfile,
  CareEventSourceAttribution,
  AttributionMapEntry,
  SourceConfidenceProfile,
  MultiCaregiverConflict,
  MultiCaregiverCareContext,
  MultiCaregiverContextResult,
  SharedRealityState,
  ProcessMultiCaregiverContextInput,
} from "./types";

export {
  attachSourceAttribution,
  attachAttributionToEvents,
  ensureEventHasAttribution,
  inferSourceType,
} from "./attribution";
export { processMultiCaregiverContext } from "./pipeline";
export { fuseSharedReality } from "./fusion-engine";
export {
  linkCaregiverToRecipient,
  ensureContributorCareReality,
  resolveCareRealityStoreKey,
  resolveCareRecipientId,
  getRecipientContext,
  appendRecipientEvents,
  getRecipientEvents,
  resetMultiCaregiverContextStore,
} from "./store";
