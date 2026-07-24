/**
 * Responsibility Graph (v1.7) — STATE ownership accountability map.
 * Architecture: Person → Responsibility → Demand → Situation (STATE).
 * Conflicts / unassigned flags influence BELIEF uncertainty — not a contact list.
 */

export {
  RESPONSIBILITY_GRAPH_IDENTITY,
  RESPONSIBILITY_GRAPH_ONE_LINE_TRUTH,
  RESPONSIBILITY_GRAPH_PIPELINE_POSITION,
  RESPONSIBILITY_GRAPH_ARCHITECTURE_LAYER,
  RESPONSIBILITY_GRAPH_FORBIDDEN,
  RESPONSIBILITY_STATUSES,
  OWNERSHIP_STATES,
  RESPONSIBILITY_HEALTH_STATES,
  HIGH_PRESSURE_RESPONSIBILITY_THRESHOLD,
  LOAD_OVERLOAD_SCORE_THRESHOLD,
} from "./contract-constants";

export type {
  Person,
  Responsibility,
  ResponsibilityStatus,
  OwnershipState,
  ResponsibilityHealthState,
  DemandOwnershipEval,
  ResponsibilityLoad,
  OwnershipConflict,
  MissedResponsibilityRecord,
  ResponsibilityGraphState,
  ResponsibilityHealth,
  ResponsibilityGraphEnvelope,
  ResponsibilityGraphGuaranteeResult,
  ResponsibilityGraphLayerResult,
  ResponsibilityGraphLayerPayload,
} from "./types";

export { createDefaultResponsibilityGraphState } from "./defaults";

export {
  resetResponsibilityGraphStore,
  getUserResponsibilityGraphState,
  setUserResponsibilityGraphState,
  bindResponsibilityGraphToUser,
  clearUserResponsibilityGraphState,
  listAllResponsibilityGraphStates,
  cloneResponsibilityGraphState,
} from "./store";

export {
  seedPersonsFromCareProfile,
  mergePersons,
  findPersonByName,
  stablePersonId,
} from "./seed";

export { isActiveResponsibilityStatus } from "./status";

export {
  stableResponsibilityId,
  detectBlockedReason,
  evaluateDemandOwnership,
  upsertResponsibility,
} from "./ownership";

export { computeResponsibilityLoads } from "./load";

export { computeResponsibilityHealth } from "./health";

export {
  detectOwnershipConflicts,
  inferOwnerAssignments,
  type InferredOwnerAssignment,
} from "./conflicts";

export {
  formatActionWithOwner,
  selectPrimaryOwnerForSurface,
  collectMissedFromResponsibilities,
  markResponsibilityFailed,
} from "./enrich";

export {
  runResponsibilityGraphGuarantee,
  validateResponsibilityGraphLayerResult,
} from "./guarantee";

export {
  processResponsibilityGraphLayer,
  toResponsibilityGraphLayerPayload,
  formatResponsibilityGraphObservation,
  applyResponsibilityOwnerToAction,
  type ProcessResponsibilityGraphLayerParams,
} from "./process";
