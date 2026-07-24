/** Continuous Care Record — retrieval-first care history for one person. */

export const CARE_RECORD_IDENTITY =
  "Continuous care record — the product is continuity, not conversation.";

export const CARE_RECORD_BOUNDARY =
  "AI organizes and retrieves; it does not replace the authoritative record.";

export type {
  ContinuousCareEventType,
  OutcomeStatus,
  CareDocumentRef,
  CareEventOutcome,
  StructuredCareEvent,
  CareRecordTimelineEntry,
  CareRecordSearchResult,
  HistoricalContextMatch,
  HistoricalContextResult,
  RecordOutcomeInput,
} from "./types";

export { CONTINUOUS_CARE_EVENT_TYPES, OUTCOME_STATUSES } from "./types";

export {
  inferContinuousEventType,
  structureCareInput,
  parseStructuredFromMetadata,
} from "./structure-input";

export {
  buildTimeline,
  searchCareRecord,
  retrieveHistoricalContext,
  mapLegacyEventType,
} from "./retrieve";

export { recordEventOutcome, linkOutcomeEvent } from "./outcome-linkage";
