import type { CanonicalCareEvent } from "../situation-entry/types";
import { ATTENTION_PANEL_THRESHOLD, UI_SURFACE_LIMIT } from "./contract-constants";
import { computePriority } from "./compute-priority";
import { toPriorityInput } from "./derive-scores";
import type { PriorityQueryResult } from "./types";

function isScorable(event: CanonicalCareEvent): boolean {
  return event.status !== "invalidated" && event.status !== "superseded";
}

function scoreOf(event: CanonicalCareEvent): number {
  if (event.priority?.priority_score != null) return event.priority.priority_score;
  const input = toPriorityInput(event, [event]);
  return computePriority(input);
}

/** Sort by priority_score descending — NOT timestamp or ingestion order. */
export function sortEventsByPriority(events: CanonicalCareEvent[]): CanonicalCareEvent[] {
  return [...events].sort((a, b) => scoreOf(b) - scoreOf(a));
}

export function getTopEvents(
  events: CanonicalCareEvent[],
  limit = UI_SURFACE_LIMIT,
): CanonicalCareEvent[] {
  return sortEventsByPriority(events.filter(isScorable)).slice(0, limit);
}

export function getAttentionEvents(events: CanonicalCareEvent[]): CanonicalCareEvent[] {
  return sortEventsByPriority(events.filter(isScorable)).filter(
    (e) => scoreOf(e) >= ATTENTION_PANEL_THRESHOLD,
  );
}

export function queryPriorityEvents(
  events: CanonicalCareEvent[],
  limit = UI_SURFACE_LIMIT,
): PriorityQueryResult<CanonicalCareEvent> {
  const scorable = events.filter(isScorable);
  const all_ranked = sortEventsByPriority(scorable);
  const top_events = all_ranked.slice(0, limit);
  const attention_events = all_ranked.filter((e) => scoreOf(e) >= ATTENTION_PANEL_THRESHOLD);

  return {
    top_events,
    attention_events,
    all_ranked,
    hidden_count: Math.max(0, all_ranked.length - limit),
  };
}
