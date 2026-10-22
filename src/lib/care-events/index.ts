export {
  CARE_EVENT_SOURCE_TYPES,
  CARE_EVENT_TYPES,
  UNCERTAINTY_LEVELS,
  type CareEventSourceType,
  type CareEventType,
  type UncertaintyLevel,
  type InputProvenance,
  type InputEntryMethod,
  type EventSourceRecord,
  type CareEventRecord,
  type CreateCareEventInput,
  type CreateCareEventResult,
} from "./types";

export { inferEventType, deriveUncertaintyLevel, deriveConfidence } from "./classify";

/** In-memory care-event cache APIs are intentionally excluded from this production barrel. */

/** Server persistence APIs are intentionally not exported through this client-safe barrel. */
