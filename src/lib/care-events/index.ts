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

export { recordCareEvent, recordCareEventWithContext } from "./record-care-event";

export {
  persistCareEventToPostgres,
  tryPersistCareEvent,
  tryLoadCareEventsForCaregiver,
} from "./postgres-store";
