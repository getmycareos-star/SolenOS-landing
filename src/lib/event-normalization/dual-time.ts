import {
  createIngestionTime,
  parseEventTimeFromText,
  temporalSortKey,
} from "../time-model";

/** Attach dual timestamps to a normalized atomic event. */
export function withNormalizedDualTime(
  label: string,
  ingestionTime: string,
): { event_time: import("../time-model").EventTime; ingestion_time: string; timestamp: string } {
  const ingestion_time = createIngestionTime(ingestionTime);
  const { event_time } = parseEventTimeFromText(label, ingestion_time);
  const timestamp = temporalSortKey(event_time, ingestion_time);
  return { event_time, ingestion_time, timestamp };
}
