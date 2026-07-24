/**
 * Server-only activation surface (Postgres + session).
 * Client code must import from `@/lib/activation-system` (index), not this file.
 */
export {
  tryLoadUserStateFromPostgres,
  trySaveUserStateToPostgres,
  trySaveEventToPostgres,
  resetActivationPoolForTests,
} from "./postgres-store";

export {
  trackActivationEvent,
  getActivationSession,
  getUserActivationMetrics,
  getDashboardActivationMetrics,
  resolveUserState,
} from "./session";
