import {
  buildDualTimelineView,
  createIngestionTime,
  parseEventTimeFromText,
  sortByTemporalOrder,
  sortByIngestionOrder,
  temporalSortKey,
} from "../time-model";
import type { EventTime } from "../time-model";
import type { CanonicalCareEvent } from "./types";
import { filterActiveEvents } from "../care-event-integrity";

export function withDualTime(
  event: Omit<CanonicalCareEvent, "event_time" | "ingestion_time" | "timestamp"> & {
    event_time?: EventTime;
    ingestion_time?: string;
  },
  rawText: string,
  ingestionTime?: string,
): CanonicalCareEvent {
  const ingestion_time = event.ingestion_time ?? createIngestionTime(ingestionTime);
  const event_time =
    event.event_time ?? parseEventTimeFromText(rawText, ingestion_time).event_time;
  const timestamp = temporalSortKey(event_time, ingestion_time);
  return { ...event, event_time, ingestion_time, timestamp };
}

export function getTemporalTimeline(events: CanonicalCareEvent[]): CanonicalCareEvent[] {
  return sortByTemporalOrder(filterActiveEvents(events));
}

export function getIngestionTimeline(events: CanonicalCareEvent[]): CanonicalCareEvent[] {
  return sortByIngestionOrder(events);
}

export function getTimelineViews(events: CanonicalCareEvent[]) {
  return buildDualTimelineView(filterActiveEvents(events));
}
