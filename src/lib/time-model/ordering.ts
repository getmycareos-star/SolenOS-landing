import { temporalSortKey } from "./parse-event-time";
import type { DualTimelineView, EventTime } from "./types";

export type TimedEvent = {
  id: string;
  event_time: EventTime;
  ingestion_time: string;
};

export function sortByTemporalOrder<T extends TimedEvent>(events: T[]): T[] {
  return [...events].sort((a, b) => {
    const ka = temporalSortKey(a.event_time, a.ingestion_time);
    const kb = temporalSortKey(b.event_time, b.ingestion_time);
    const cmp = kb.localeCompare(ka);
    if (cmp !== 0) return cmp;
    return b.ingestion_time.localeCompare(a.ingestion_time);
  });
}

export function sortByIngestionOrder<T extends TimedEvent>(events: T[]): T[] {
  return [...events].sort((a, b) => b.ingestion_time.localeCompare(a.ingestion_time));
}

export function buildDualTimelineView<T extends TimedEvent>(events: T[]): DualTimelineView {
  return {
    temporal_order: sortByTemporalOrder(events).map((e) => e.id),
    ingestion_order: sortByIngestionOrder(events).map((e) => e.id),
  };
}

export function isWithinEventTimeWindow(
  eventTime: EventTime,
  windowStart: string,
  windowEnd: string,
): boolean {
  const key = temporalSortKey(eventTime, windowStart);
  return key >= windowStart && key <= windowEnd;
}

/** Pattern windows anchor on event_time; fall back to ingestion_time only if unknown. */
export function windowAnchorTime(event: TimedEvent): string {
  if (event.event_time.type === "unknown") return event.ingestion_time;
  return temporalSortKey(event.event_time, event.ingestion_time);
}
