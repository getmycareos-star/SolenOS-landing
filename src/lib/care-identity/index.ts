export {

  DEFAULT_DURABLE_CARE_KEY,

  DURABLE_CARE_KEY_STORAGE,

  CARE_RECIPIENT_ID_STORAGE,

  INTERACTION_SESSION_STORAGE,

  resolveDurableCareKey,

  requireCareKeyFromRequest,

  mintDurableCareKey,

  mintInteractionSessionId,

  isInteractionSessionId,

  ensureClientDurableCareKey,

  ensureClientInteractionSessionId,

  careSessionIdForDurableKey,

  resolveInteractionSessionId,

} from "./durable-care-key";

export {
  CARE_IDENTITY_PURPOSE,
  type CareIdentityLifecycle,
  type CareIdentityRecord,
  type CareIdentitySummary,
  type ContinuityType,
  type ContinuityContext,
  createCareIdentity,
  transitCareIdentityLifecycle,
  recordCareEvent,
  incrementSessionCount,
  getCareIdentity,
  listCareIdentitiesForCaregiver,
  listAllCareIdentities,
  getCareIdentitySummary,
  isNewCaregiver,
  isReturningCaregiver,
  resolveActiveCareRecipientId,
  loadCareContextForIdentity,
  resetCareIdentityStore,
} from "./care-identity";

export {
  type InputRelation,
  type CareRealityDiff,
  type ContinuityDecision,
  detectInputRelation,
  compareInputToCareReality,
  detectContinuity,
} from "./continuity-detection";


