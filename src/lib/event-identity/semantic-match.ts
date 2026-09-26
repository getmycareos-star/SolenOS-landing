import type { IncomingEvidence, ExistingEvent } from "./types";
import { temporalSortKey } from "../time-model";
import { parseEventTimeFromText } from "../time-model";

/** Semantic similarity for event matching beyond exact text. */
export function semanticEventMatch(
  incoming: IncomingEvidence,
  existing: ExistingEvent,
): { match: boolean; confidence: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  // Same person (required)
  if (incoming.person_id !== existing.person_id) {
    return { match: false, confidence: 0, reasons: ["Different person"] };
  }

  // Same event type (strong signal)
  if (incoming.extracted_type && existing.attributes.event_type === incoming.extracted_type) {
    score += 0.3;
    reasons.push("Same event type");
  } else if (incoming.extracted_type && existing.extracted_type === incoming.extracted_type) {
    score += 0.25;
    reasons.push("Same extracted type");
  }

  // Entity overlap
  const incomingEntities = new Set((incoming.entities ?? []).map(e => e.toLowerCase()));
  const existingEntities = new Set((existing.entities ?? []).map(e => e.toLowerCase()));
  const entityOverlap = [...incomingEntities].filter(e => existingEntities.has(e)).length;
  if (entityOverlap > 0) {
    score += Math.min(0.2, entityOverlap * 0.1);
    reasons.push(`${entityOverlap} shared entities`);
  }

  // Location match
  const incomingLoc = (incoming.attributes?.location as string)?.toLowerCase();
  const existingLoc = (existing.attributes?.location as string)?.toLowerCase();
  if (incomingLoc && existingLoc && incomingLoc === existingLoc) {
    score += 0.15;
    reasons.push("Same location");
  }

  // Temporal proximity
  const incomingTime = parseEventTimeFromText(incoming.content, incoming.captured_at).event_time;
  const existingTime = parseEventTimeFromText(existing.content, existing.created_at).event_time;
  if (incomingTime && existingTime) {
    const incomingMs = new Date(temporalSortKey(incomingTime, incoming.captured_at)).getTime();
    const existingMs = new Date(temporalSortKey(existingTime, existing.created_at)).getTime();
    const diffHours = Math.abs(incomingMs - existingMs) / (1000 * 60 * 60);
    if (diffHours <= 24) {
      score += 0.2;
      reasons.push(`Temporal proximity: ${diffHours.toFixed(1)}h apart`);
    } else if (diffHours <= 72) {
      score += 0.1;
      reasons.push(`Temporal proximity: ${diffHours.toFixed(1)}h apart`);
    }
  }

  // Semantic content similarity (beyond exact match)
  const contentSim = semanticContentSimilarity(incoming.content, existing.content);
  if (contentSim > 0.6) {
    score += 0.15;
    reasons.push(`Semantic similarity: ${(contentSim * 100).toFixed(0)}%`);
  }

  const match = score >= 0.5;
  return { match, confidence: Math.min(score, 1), reasons };
}

function semanticContentSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
  const union = wordsA.size + wordsB.size - intersection;
  return union > 0 ? intersection / union : 0;
}
