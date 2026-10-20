import type { CanonicalCareEvent } from "../situation-entry/types";
import { ENTITY_MATCH_THRESHOLD, EVENT_MATCH_WINDOW_DAYS } from "./contract-constants";
import type { EntityMatch, EventMatch } from "./types";

function normalizeLabel(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
}

function labelSimilarity(a: string, b: string): number {
  const na = normalizeLabel(a);
  const nb = normalizeLabel(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  const wordsA = new Set(na.split(/\s+/));
  const wordsB = new Set(nb.split(/\s+/));
  const overlap = [...wordsA].filter((w) => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  return union > 0 ? overlap / union : 0;
}

export function matchEntities(
  newEvents: CanonicalCareEvent[],
  existingEvents: CanonicalCareEvent[],
): EntityMatch[] {
  const existingEntities = new Map<string, { kind: string; eventIds: string[] }>();

  for (const event of existingEvents) {
    for (const entity of event.entities) {
      const key = normalizeLabel(entity.label);
      const entry = existingEntities.get(key) ?? { kind: entity.kind, eventIds: [] };
      entry.eventIds.push(event.id);
      existingEntities.set(key, entry);
    }
  }

  const matches: EntityMatch[] = [];
  const seen = new Set<string>();

  for (const event of newEvents) {
    for (const entity of event.entities) {
      const key = normalizeLabel(entity.label);
      if (seen.has(key)) continue;
      seen.add(key);

      let bestMatch: { eventIds: string[]; confidence: number } | null = null;

      for (const [existingKey, data] of existingEntities) {
        const sim = labelSimilarity(entity.label, existingKey);
        if (sim >= ENTITY_MATCH_THRESHOLD && (!bestMatch || sim > bestMatch.confidence)) {
          bestMatch = { eventIds: data.eventIds, confidence: sim };
        }
      }

      matches.push({
        entity_label: entity.label,
        entity_kind: entity.kind,
        matched_event_ids: bestMatch?.eventIds ?? [],
        match_confidence: bestMatch?.confidence ?? 0,
        is_new: !bestMatch,
      });
    }
  }

  return matches;
}

export function matchEvents(
  newEvents: CanonicalCareEvent[],
  existingEvents: CanonicalCareEvent[],
): EventMatch[] {
  const matches: EventMatch[] = [];
  const windowMs = EVENT_MATCH_WINDOW_DAYS * 86400000;

  for (const newEvent of newEvents) {
    for (const existing of existingEvents) {
      if (existing.id === newEvent.id) continue;

      const timeDiff = Math.abs(
        new Date(newEvent.timestamp).getTime() - new Date(existing.timestamp).getTime(),
      );

      if (newEvent.extracted_type === existing.extracted_type && timeDiff < windowMs) {
        const inputSim = labelSimilarity(newEvent.raw_input, existing.raw_input);
        if (inputSim >= 0.5) {
          matches.push({
            new_event_id: newEvent.id,
            existing_event_id: existing.id,
            match_reason: `Same ${newEvent.extracted_type.replace(/_/g, " ")} within ${EVENT_MATCH_WINDOW_DAYS} days`,
            match_confidence: inputSim,
          });
          continue;
        }
      }

      if (
        newEvent.extracted_type === "follow_up" &&
        /\b(appointment|visit|follow[- ]?up)\b/i.test(existing.raw_input)
      ) {
        matches.push({
          new_event_id: newEvent.id,
          existing_event_id: existing.id,
          match_reason: "Follow-up linked to prior appointment",
          match_confidence: 0.75,
        });
      }

      if (newEvent.document_id && newEvent.document_id === existing.document_id) {
        matches.push({
          new_event_id: newEvent.id,
          existing_event_id: existing.id,
          match_reason: "Same document source",
          match_confidence: 0.9,
        });
      }
    }
  }

  const deduped = matches.filter(
    (m, i, arr) =>
      arr.findIndex(
        (x) => x.new_event_id === m.new_event_id && x.existing_event_id === m.existing_event_id,
      ) === i,
  );

  return deduped;
}

export function extractEntitiesFromEvents(events: CanonicalCareEvent[]): string[] {
  const entities = new Set<string>();
  for (const event of events) {
    for (const e of event.entities) {
      entities.add(e.label);
    }
  }
  return [...entities];
}
