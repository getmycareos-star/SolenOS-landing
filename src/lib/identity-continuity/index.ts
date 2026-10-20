export {
  IDENTITY_CONTINUITY_PURPOSE,
  IDENTITY_CONTINUITY_ONE_LINE_TRUTH,
  IDENTITY_CONTINUITY_FORBIDDEN,
  PERSISTENCE_TRIGGER_IDS,
  SIGNUP_PROMPT_MESSAGE,
  LOGIN_PROMPT_MESSAGE,
  CONTINUITY_RESPONSE_HEADERS,
  type PersistenceTriggerId,
} from "./contract-constants";

export type {
  CareStateMode,
  CareGraphSummary,
  MemoryNode,
  ActiveDecision,
  CareGraphState,
  IdentityContinuityState,
  PersistenceSignals,
  ContinuityPromptAction,
  ContinuityPromptReason,
  ContinuityPrompt,
  ContinuityLayerPayload,
  RehydratedCareState,
} from "./types";

export {
  ContinuityLayerPayloadSchema,
  ContinuityPromptSchema,
  IdentitySignupRequestSchema,
  IdentityLoginRequestSchema,
  type IdentitySignupRequest,
  type IdentityLoginRequest,
} from "./schema";

export {
  requiresPersistence,
  evaluateRequiresPersistence,
  buildPersistenceSignals,
  activePersistenceTriggers,
} from "./persistence-evaluator";

export { shouldPromptSignup, shouldPromptLogin, resolveContinuityPrompt } from "./prompt-logic";

export {
  resetCareStateStoreForTests,
  getCareSession,
  getOrCreateCareSession,
  getPersistentSessionForUser,
  upgradeSessionToPersistent,
} from "./care-state-store";

export {
  restoreCareGraph,
  hydrateMemoryState,
  resumeContinuityState,
  rebindActiveDecisions,
  rehydrateCareState,
  rehydrateCareSession,
} from "./rehydration";

export {
  upgradeEphemeralToPersistent,
  authenticatePersistentUser,
  bindSessionToUser,
  resetAuthCredentialsForTests,
  type StateUpgradeResult,
} from "./state-upgrade";

export {
  evaluatePostAnalyzeContinuity,
  type EvaluatePostAnalyzeContinuityParams,
  type EvaluatePostAnalyzeContinuityResult,
} from "./evaluate-continuity";

export {
  handleUserInteraction,
  type HandleUserInteractionParams,
  type HandleUserInteractionResult,
} from "./handle-interaction";
