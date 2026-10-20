import { CONFIRMATION_PATTERNS, RESOLVED_PATTERNS } from "./contract-constants";
import { daysBetween } from "../continuity-decay-engine/compute-decay";
import type { CanonicalCareEvent } from "../situation-entry/types";
import type { MemoryRecord, MemoryTransition } from "./types";

export function detectReinforcements(
  events: CanonicalCareEvent[],
  records: MemoryRecord[],
  asOf: string,
): { reinforced: string[]; records: MemoryRecord[] } {
  const reinforced: string[] = [];
  const updated = records.map((r) => ({ ...r }));

  for (const event of events) {
    if (!CONFIRMATION_PATTERNS.some((p) => p.test(event.raw_input))) continue;
    for (const record of updated) {
      if (record.status !== "active") continue;
      if (record.tier === "session") continue;
      reinforced.push(record.id);
      record.confidence_pct = Math.min(98, record.confidence_pct + 15);
      record.last_confirmed_at = event.ingestion_time;
    }
  }

  return { reinforced: [...new Set(reinforced)], records: updated };
}

export function detectExpirations(
  records: MemoryRecord[],
  asOf: string,
): { expired: string[]; records: MemoryRecord[] } {
  const expired: string[] = [];
  const updated = records.map((r) => {
    if (r.status !== "active" || !r.expires_at) return r;
    if (daysBetween(r.expires_at, asOf) > 0 || new Date(asOf) > new Date(r.expires_at)) {
      expired.push(r.id);
      return { ...r, status: "expired" as const };
    }
    return r;
  });
  return { expired, records: updated };
}

export function detectDemotions(
  events: CanonicalCareEvent[],
  records: MemoryRecord[],
): { demotions: MemoryTransition[]; records: MemoryRecord[] } {
  const demotions: MemoryTransition[] = [];
  const updated = records.map((r) => ({ ...r }));

  for (const event of events) {
    if (!RESOLVED_PATTERNS.some((p) => p.test(event.raw_input))) continue;
    for (const record of updated) {
      if (record.tier !== "short_lived" || record.status !== "active") continue;
      demotions.push({
        transition_id: `dem_${record.id}_${event.id}`,
        memory_id: record.id,
        from_state: "active short_lived",
        to_state: "archived historical",
        reason: "Resolved or recovered — no longer active problem",
        source_event_id: event.id,
        recorded_at: event.ingestion_time,
      });
      record.status = "archived";
    }
  }

  return { demotions, records: updated };
}

export function detectPromotions(
  events: CanonicalCareEvent[],
  records: MemoryRecord[],
): { promotions: MemoryTransition[]; records: MemoryRecord[] } {
  const promotions: MemoryTransition[] = [];
  const updated = records.map((r) => ({ ...r }));

  const confirmationCount = events.filter((e) =>
    CONFIRMATION_PATTERNS.some((p) => p.test(e.raw_input)),
  ).length;

  for (const record of updated) {
    if (!record.promotion_eligible || record.tier !== "short_lived") continue;
    if (confirmationCount >= 2 || record.confidence_pct >= 75) {
      promotions.push({
        transition_id: `prom_${record.id}`,
        memory_id: record.id,
        from_state: "short_lived",
        to_state: "long_lived",
        reason: "Repeated confirmation or high confidence — evidence supports promotion",
        source_event_id: record.source_event_id,
        recorded_at: new Date().toISOString(),
      });
      record.tier = "long_lived";
      record.status = "promoted";
      record.expires_at = null;
    }
  }

  return { promotions, records: updated };
}
