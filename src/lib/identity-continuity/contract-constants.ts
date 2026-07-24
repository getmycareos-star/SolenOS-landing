/**
 * Identity Continuity — users log in to continue a caregiving reality
 * the system has already started helping them manage.
 */

export const IDENTITY_CONTINUITY_PURPOSE =
  "Bind ephemeral care value to persistent continuity — never gate first inference.";

export const IDENTITY_CONTINUITY_ONE_LINE_TRUTH =
  "System works immediately → preserve continuity → bind identity.";

export const IDENTITY_CONTINUITY_FORBIDDEN = [
  "blocking inference on auth",
  "signup as entry gate or paywall",
  "resetting care state on auth",
  "login as session validation gate",
  "onboarding or reconfiguration on login",
] as const;

/** Strict signup triggers — ANY true after value is produced. */
export const PERSISTENCE_TRIGGER_IDS = [
  "care_graph_created",
  "memory_node_created",
  "multi_step_dependency_detected",
  "user_remember_request",
  "return_behavior_detected",
  "document_uploaded",
] as const;

export type PersistenceTriggerId = (typeof PERSISTENCE_TRIGGER_IDS)[number];

export const SIGNUP_PROMPT_MESSAGE =
  "Save this care situation so you don't lose it.";

export const LOGIN_PROMPT_MESSAGE =
  "Continue your saved care situation.";

export const CONTINUITY_RESPONSE_HEADERS = {
  sessionId: "x-solenos-care-session-id",
} as const;
