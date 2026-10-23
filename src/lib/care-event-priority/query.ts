import type { CanonicalCareEvent } from "../situation-entry/types";
import { ATTENTION_PANEL_THRESHOLD, UI_SURFACE_LIMIT } from "./contract-constants";
import type { PriorityQueryResult } from "./types";

function isScorable(event: CanonicalCareEvent): boolean {
  return event.status !== "invalidated" && event.status !== "superseded";
}

function scoreOf(event: CanonicalCareEvent): number | null {
  return event.priority?.priority_score ?? null;
}

/** Sort by priority_score descending — NOT timestamp or ingestion order. */
export function sortEventsByPriority(events: CanonicalCareEvent[]): CanonicalCareEvent[] {
  return [...events].sort((a, b) => {
    const scoreA = scoreOf(a);
    const scoreB = scoreOf(b);
    if (scoreA == null && scoreB == null) return 0;
    if (scoreA == null) return 1;
    if (scoreB == null) return -1;
    return scoreB - scoreA;
  });
}

export function getTopEvents(
  events: CanonicalCareEvent[],
  limit = UI_SURFACE_LIMIT,
): CanonicalCareEvent[] {
  return sortEventsByPriority(events.filter(isScorable)).slice(0, limit);
}

export function getAttentionEvents(events: CanonicalCareEvent[]): CanonicalCareEvent[] {
  return sortEventsByPriority(events.filter(isScorable)).filter((e) => {
    const score = scoreOf(e);
    return score != null && score >= ATTENTION_PANEL_THRESHOLD;
  });
}

export function queryPriorityEvents(
  events: CanonicalCareEvent[],
  limit = UI_SURFACE_LIMIT,
): PriorityQueryResult<CanonicalCareEvent> {
  const scorable = events.filter(isScorable);
  const all_ranked = sortEventsByPriority(scorable);
  const top_events = all_ranked.slice(0, limit);
  const attention_events = all_ranked.filter((e) => {
    const score = scoreOf(e);
    return score != null && score >= ATTENTION_PANEL_THRESHOLD;
  });

  return {
    top_events,
    attention_events,
    all_ranked,
    hidden_count: Math.max(0, all_ranked.length - limit),
  };
}
