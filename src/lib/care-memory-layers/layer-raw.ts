import type { CanonicalCareEvent } from "../situation-entry/types";
import type { RawEventRef } from "./types";

/** Layer 1 — convert canonical events to immutable raw refs. Never delete. */
export function toRawEventRef(event: CanonicalCareEvent): RawEventRef {
  return {
    layer: "raw_event",
    event_id: event.id,
    timestamp: event.timestamp,
    ingestion_time: event.ingestion_time,
    extracted_type: event.extracted_type,
    status: event.status,
    source: event.source,
    document_id: event.document_id,
    preserved: true,
  };
}

export function rawRefsFromEvents(events: CanonicalCareEvent[]): RawEventRef[] {
  return events.map(toRawEventRef);
}

/** Preservation rule — raw layer count never decreases on compaction. */
export function assertRawPreservation(
  before: RawEventRef[],
  after: RawEventRef[],
): boolean {
  const beforeIds = new Set(before.map((r) => r.event_id));
  return after.every((r) => beforeIds.has(r.event_id) || r.preserved);
}

export function indexRawByTime(refs: RawEventRef[]): Map<string, RawEventRef[]> {
  const byMonth = new Map<string, RawEventRef[]>();
  for (const ref of refs) {
    const key = ref.timestamp.slice(0, 7);
    const list = byMonth.get(key) ?? [];
    list.push(ref);
    byMonth.set(key, list);
  }
  return byMonth;
}

export function indexRawByStatus(refs: RawEventRef[]): Map<string, RawEventRef[]> {
  const map = new Map<string, RawEventRef[]>();
  for (const ref of refs) {
    const list = map.get(ref.status) ?? [];
    list.push(ref);
    map.set(ref.status, list);
  }
  return map;
}

export function indexRawByEpisode(
  refs: RawEventRef[],
  eventToEpisode: Map<string, string>,
): Map<string, RawEventRef[]> {
  const map = new Map<string, RawEventRef[]>();
  for (const ref of refs) {
    const epId = eventToEpisode.get(ref.event_id);
    if (!epId) continue;
    const list = map.get(epId) ?? [];
    list.push(ref);
    map.set(epId, list);
  }
  return map;
}
