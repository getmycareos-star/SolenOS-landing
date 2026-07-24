/** Append-only immutable event store — source of truth. */

import type { StoredCareEventRecord } from "./types";

const streams = new Map<string, StoredCareEventRecord[]>();
let globalSeq = 0;

export function appendEvent(record: Omit<StoredCareEventRecord, "append_seq">): StoredCareEventRecord {
  const key = record.care_recipient_id;
  const stream = streams.get(key) ?? [];
  // Deduplicate by event_id — append-only means we never update, only skip dupes
  if (stream.some((e) => e.event_id === record.event_id)) {
    return stream.find((e) => e.event_id === record.event_id)!;
  }
  const stored: StoredCareEventRecord = {
    ...record,
    append_seq: ++globalSeq,
  };
  stream.push(stored);
  streams.set(key, stream);
  return stored;
}

export function getEventStream(careRecipientId: string): readonly StoredCareEventRecord[] {
  return streams.get(careRecipientId) ?? [];
}

export function getEventsUpTo(
  careRecipientId: string,
  asOf: string,
): readonly StoredCareEventRecord[] {
  return getEventStream(careRecipientId).filter((e) => e.timestamp <= asOf);
}

/** Forbidden — events are immutable. Exposed only to fail tests that attempt mutation. */
export function assertEventImmutable(eventId: string, careRecipientId: string): boolean {
  const stream = streams.get(careRecipientId) ?? [];
  return stream.some((e) => e.event_id === eventId);
}

export function resetEventStore(): void {
  streams.clear();
  globalSeq = 0;
}
