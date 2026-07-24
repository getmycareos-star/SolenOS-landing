/**
 * Server-only dementia care-context operations (memory + Postgres hydrate).
 * Client panels must use `@/lib/care-contexts` for labels/types only.
 */
export {
  createEventId,
  getDementiaProfileView,
  setCareContext,
  updateDementiaContext,
  addWanderingEvent,
  addFinancialRiskEvent,
  updateDrivingStatus,
} from "./operations";

export type { DementiaProfileView } from "./types";
