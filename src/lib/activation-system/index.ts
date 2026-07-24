/**
 * Client-safe activation surface. Postgres/session live in `./server`.
 */
export {
  ACTIVATION_ACKNOWLEDGEMENT,
  ACTIVATION_FORBIDDEN,
  APPOINTMENT_PROMPT,
  FORBIDDEN_REENGAGEMENT_COPY,
  REENGAGEMENT_INACTIVE_DAYS,
  REENGAGEMENT_MESSAGES,
  RESOLUTION_PROMPT,
  TRUST_STAGE_BUILDING_MAX,
  TRUST_STAGE_EARLY_MAX,
} from "./contract-constants";

export type {
  ActivationEvent,
  ActivationEventType,
  ActivationSessionContext,
  ActivationUserState,
  ContextualPrompt,
  ContextualPromptType,
  DashboardActivationMetrics,
  RecordActivationEventInput,
  TrustStage,
  UserActivationMetrics,
} from "./types";

export { ACTIVATION_EVENT_TYPES, TRUST_STAGES, CONTEXTUAL_PROMPT_TYPES } from "./types";

export {
  computeTrustStage,
  trustStageAllowsOptionalContext,
  trustStageAllowsRichContinuity,
} from "./trust-progression";

export {
  buildActivationSessionContext,
  computeHabitHour,
  createDefaultUserState,
  createEventId,
  habitWindowPromptForHour,
  isWithinHabitWindow,
  selectContextualPrompt,
} from "./prompts";

export {
  getOrCreateUserState,
  hydrateUserState,
  recordActivationEvent,
  computeUserMetrics,
  computeDashboardMetrics,
  resetActivationStoreForTests,
} from "./store";

export {
  readDismissedPromptTypes,
  dismissPromptType,
  trackClientActivationEvent,
  fetchActivationSession,
  ACTIVATION_DISMISSED_PROMPTS_KEY,
  ACTIVATION_PRIOR_FOLLOW_UP_KEY,
  ACTIVATION_LAST_SNIPPET_KEY,
} from "./client";
