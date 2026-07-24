import type { CanonicalCareEvent } from "../situation-entry/types";
import type { ProvenanceRecord } from "../trust-provenance/types";
import type { TrustKnownItem } from "./types";

export function buildKnownFacts(
  events: CanonicalCareEvent[],
  provenanceRecords: ProvenanceRecord[],
): TrustKnownItem[] {
  const known: TrustKnownItem[] = [];
  const seen = new Set<string>();

  for (const record of provenanceRecords) {
    if (
      record.verification_status !== "user_confirmed" &&
      record.source_type !== "document" &&
      record.source_type !== "pdf"
    ) {
      continue;
    }
    const key = record.fact_label.slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);
    known.push({
      statement: record.fact_label,
      source: record.source_label,
      source_type:
        record.source_type === "document" || record.source_type === "pdf"
          ? "document"
          : "care_event",
      source_event_id: record.event_id ?? undefined,
    });
  }

  for (const event of events) {
    if (event.status === "invalidated" || event.status === "superseded") continue;
    const text = event.raw_input.trim();
    if (!text || text.length < 8) continue;
    const key = text.slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);

    known.push({
      statement: text.slice(0, 160),
      source: event.source === "document" ? "uploaded document" : "verified caregiver input",
      source_type: event.source === "document" ? "document" : "caregiver_input",
      source_event_id: event.id,
    });
  }

  return known.slice(0, 10);
}
