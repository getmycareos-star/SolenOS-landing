import { DEDUP_TIME_WINDOW_MS } from "./contract-constants";
import type { NormalizedAtomicEvent } from "./types";
import { temporalSortKey } from "../time-model";

function normalizeLabel(text: string): string {
  return text
    .toLowerCase()
    .replace(/\b(the|a|an|with|on|at)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sameEntity(a: NormalizedAtomicEvent, b: NormalizedAtomicEvent): boolean {
  if (a.entities.length === 0 && b.entities.length === 0) return true;
  const setA = new Set(a.entities.map((e) => e.toLowerCase()));
  return b.entities.some((e) => setA.has(e.toLowerCase()));
}

function withinTimeWindow(a: NormalizedAtomicEvent, b: NormalizedAtomicEvent): boolean {
  const ta = a.event_time
    ? new Date(temporalSortKey(a.event_time, a.ingestion_time)).getTime()
    : new Date(a.timestamp).getTime();
  const tb = b.event_time
    ? new Date(temporalSortKey(b.event_time, b.ingestion_time)).getTime()
    : new Date(b.timestamp).getTime();
  return Math.abs(ta - tb) <= DEDUP_TIME_WINDOW_MS;
}

function similarLabels(a: string, b: string): boolean {
  const na = normalizeLabel(a);
  const nb = normalizeLabel(b);
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const wordsA = new Set(na.split(" "));
  const wordsB = new Set(nb.split(" "));
  const overlap = [...wordsA].filter((w) => wordsB.has(w) && w.length > 3).length;
  return overlap >= 2;
}

/** Merge duplicate events: same entity, type, ±48h. */
export function deduplicateEvents(
  incoming: NormalizedAtomicEvent[],
  existing: NormalizedAtomicEvent[],
): {
  toCommit: NormalizedAtomicEvent[];
  merged: { kept: NormalizedAtomicEvent; mergedId: string; description: string }[];
} {
  const toCommit: NormalizedAtomicEvent[] = [];
  const merged: { kept: NormalizedAtomicEvent; mergedId: string; description: string }[] = [];
  const pool = [...existing];

  for (const event of incoming) {
    const dup = pool.find(
      (e) =>
        e.atomic_type === event.atomic_type &&
        sameEntity(e, event) &&
        withinTimeWindow(e, event) &&
        similarLabels(e.label, event.label),
    );

    if (dup) {
      const kept: NormalizedAtomicEvent = {
        ...dup,
        confidence: Math.max(dup.confidence, event.confidence),
        merged_from_ids: [...dup.merged_from_ids, event.id],
        attributes: { ...dup.attributes, ...event.attributes },
      };
      merged.push({
        kept,
        mergedId: event.id,
        description: `Merged duplicate ${event.atomic_type}: "${event.label.slice(0, 40)}" into existing event`,
      });
      const idx = pool.findIndex((p) => p.id === dup.id);
      if (idx >= 0) pool[idx] = kept;
    } else {
      toCommit.push(event);
      pool.push(event);
    }
  }

  return { toCommit, merged };
}
