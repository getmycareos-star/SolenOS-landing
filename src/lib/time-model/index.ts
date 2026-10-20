export {
  TIME_MODEL_IDENTITY,
  EVENT_TIME_TYPES,
  RETIMING_REASONS,
  PATTERN_WINDOW_ANCHOR,
} from "./contract-constants";

export type {
  EventTimeType,
  EventTime,
  CareEventTime,
  CareEventTimeCorrection,
  RetimingReason,
  ParseEventTimeResult,
  DualTimelineView,
} from "./types";

export {
  parseEventTimeFromText,
  createExactEventTime,
  createIngestionTime,
  temporalSortKey,
  formatEventTimeLabel,
} from "./parse-event-time";

export {
  sortByTemporalOrder,
  sortByIngestionOrder,
  buildDualTimelineView,
  isWithinEventTimeWindow,
  windowAnchorTime,
  type TimedEvent,
} from "./ordering";

export {
  applyEventTimeCorrection,
  applyRetrospectiveUpdate,
  getTimeCorrectionsForEvent,
  resetTimeCorrectionStore,
} from "./retiming";

export { resolveLateArrival, type LateArrivalMatch, type ExistingTimedEvent } from "./late-arrival";

import type { EventTime } from "./types";
import {
  createIngestionTime,
  parseEventTimeFromText,
  temporalSortKey,
} from "./parse-event-time";

export function attachDualTimeToEvent<T extends Record<string, unknown>>(
  event: T,
  rawText: string,
  ingestionTime?: string,
): T & { event_time: EventTime; ingestion_time: string } {
  const ingestion = createIngestionTime(ingestionTime);
  const { event_time } = parseEventTimeFromText(rawText, ingestion);
  return { ...event, event_time, ingestion_time: ingestion };
}
