/**
 * Identity domain — user creation, auth, sessions.
 * NO caregiving, memory, document, or decision logic.
 */

export const IDENTITY_DOMAIN_PURPOSE =
  "Minimal user identity and session keys — anonymous ledger users or optional auth.";

export const IDENTITY_FORBIDDEN = [
  "caregiving logic",
  "memory storage",
  "document processing",
  "decision generation",
] as const;

export { getTelemetryStore, recordReliefMeasurementEvent } from "../../telemetry-persistence/server";

export {
  handleUserInteraction,
  evaluatePostAnalyzeContinuity,
  requiresPersistence,
  shouldPromptSignup,
  shouldPromptLogin,
  rehydrateCareState,
  upgradeEphemeralToPersistent,
  type ContinuityLayerPayload,
  type IdentityContinuityState,
} from "../../identity-continuity";
