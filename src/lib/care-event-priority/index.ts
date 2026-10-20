export {
  CARE_EVENT_PRIORITY_IDENTITY,
  PRIORITY_TIERS,
  ATTENTION_STATUSES,
  DEFAULT_UNCERTAINTY,
  DEFAULT_URGENCY,
  DEFAULT_DEPENDENCY_COUNT,
  PROVISIONAL_UNCERTAINTY,
  CRITICAL_THRESHOLD,
  IMPORTANT_THRESHOLD,
  CONTEXTUAL_THRESHOLD,
  UI_SURFACE_LIMIT,
  ATTENTION_PANEL_THRESHOLD,
  PRIORITY_WEIGHTS,
} from "./contract-constants";

export type {
  PriorityTier,
  AttentionStatus,
  CareEventPriorityInput,
  CareEventPriority,
  ScoredCareEvent,
  PriorityQueryResult,
} from "./types";

export { computePriority, classifyPriorityTier, isAttentionWorthy } from "./compute-priority";

export {
  mapLifecycleToAttentionStatus,
  computeRecencyDays,
  deriveUrgency,
  deriveUncertaintyScore,
  deriveDependencyCount,
  toPriorityInput,
} from "./derive-scores";

export {
  buildPriorityFields,
  attachPriorityToEvent,
  attachPriorityToEvents,
  createStubPriority,
} from "./attach-priority";

export {
  sortEventsByPriority,
  getTopEvents,
  getAttentionEvents,
  queryPriorityEvents,
} from "./query";
