/** Derived tables — disposable analytics rebuilt from Event Store. */

import type { DerivedTableRecord } from "./types";
import { getEventStream } from "./event-store";

const derived = new Map<string, DerivedTableRecord>();

export function rebuildDerivedTable(
  careRecipientId: string,
  tableKey: string,
): DerivedTableRecord {
  const events = getEventStream(careRecipientId);
  const record: DerivedTableRecord = {
    table_key: `${careRecipientId}:${tableKey}`,
    rebuilt_at: new Date().toISOString(),
    disposable: true,
    payload: {
      event_count: events.length,
      type_histogram: events.reduce<Record<string, number>>((acc, e) => {
        acc[e.normalized_type] = (acc[e.normalized_type] ?? 0) + 1;
        return acc;
      }, {}),
      avg_confidence:
        events.length === 0
          ? 0
          : events.reduce((s, e) => s + e.confidence, 0) / events.length,
    },
  };
  derived.set(record.table_key, record);
  return record;
}

export function resetDerivedTables(): void {
  derived.clear();
}
