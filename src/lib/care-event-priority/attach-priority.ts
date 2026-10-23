import type { CanonicalCareEvent } from "../situation-entry/types";
import {
  DEFAULT_DEPENDENCY_COUNT,
  DEFAULT_UNCERTAINTY,
  DEFAULT_URGENCY,
  PROVISIONAL_UNCERTAINTY,
} from "./contract-constants";
import { classifyPriorityTier, computePriority } from "./compute-priority";
import { toPriorityInput } from "./derive-scores";
import type { AttentionStatus, CareEventPriority } from "./types";
export function buildPriorityFields(
  event: CanonicalCareEvent,
  allEvents: CanonicalCareEvent[],
  reference = new Date(),
): CareEventPriority {
  const input = toPriorityInput(event, allEvents, reference);
  const priority_score = computePriority(input);
  return {
    urgency: input.urgency,
    uncertainty: input.uncertainty,
    dependency_count: input.dependency_count,
    recency_days: input.recency_days,
    priority_score,
    tier: classifyPriorityTier(priority_score),
    attention_status: input.attention_status,
  };
}

/** Attach or refresh priority on a single event. */
export function attachPriorityToEvent(
  event: CanonicalCareEvent,
  allEvents: CanonicalCareEvent[],
  reference = new Date(),
): CanonicalCareEvent {
  return {
    ...event,
    priority: buildPriorityFields(event, allEvents, reference),
  };
}

/** Recompute priority for all events in a batch (dependency-aware). */
export function attachPriorityToEvents(
  events: CanonicalCareEvent[],
  reference = new Date(),
): CanonicalCareEvent[] {
  return events.map((e) => attachPriorityToEvent(e, events, reference));
}

/** Explicit unknown priority until a real event-based recomputation runs. */
export function createStubPriority(
  attentionStatus: AttentionStatus = "active",
): CareEventPriority {
  return {
    urgency: null,
    uncertainty: null,
    dependency_count: null,
    recency_days: null,
    priority_score: null,
    tier: null,
    attention_status: attentionStatus,
  };
}
