import type { CanonicalCareEvent } from "../situation-entry/types";
import type { CareEventLifecycleStatus } from "../care-event-integrity/types";
import {
  DEFAULT_DEPENDENCY_COUNT,
  DEFAULT_UNCERTAINTY,
  DEFAULT_URGENCY,
  PROVISIONAL_UNCERTAINTY,
} from "./contract-constants";
import type { AttentionStatus, CareEventPriorityInput } from "./types";

const URGENCY_BY_TYPE: Record<string, number> = {
  incident: 85,
  financial_issue: 75,
  follow_up: 70,
  behavioral_change: 65,
  coordination_issue: 55,
  contact_event: 50,
  administrative_issue: 45,
  observation: 35,
  document_fact: 30,
  decision: 40,
  unparsed_raw: 60,
  unprocessed_input: 55,
  correction: 25,
  unknown: 50,
};

export function mapLifecycleToAttentionStatus(
  status: CareEventLifecycleStatus,
): AttentionStatus {
  if (status === "invalidated") return "invalidated";
  if (status === "superseded") return "resolved";
  if (status === "provisional" || status === "unparsed_raw") return "provisional";
  return "active";
}

export function computeRecencyDays(timestamp: string, reference = new Date()): number {
  const ms = reference.getTime() - new Date(timestamp).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export function deriveUrgency(event: CanonicalCareEvent): number {
  const base = URGENCY_BY_TYPE[event.extracted_type] ?? DEFAULT_URGENCY;
  if (event.extracted_type === "incident" && /fell|fall|hospital|emergency/i.test(event.raw_input)) {
    return Math.min(100, base + 5);
  }
  if (/reject|denied|urgent|asap|immediately/i.test(event.raw_input)) {
    return Math.min(100, base + 10);
  }
  return base;
}

export function deriveUncertaintyScore(event: CanonicalCareEvent): number {
  if (event.status === "provisional" || event.status === "unparsed_raw") {
    return PROVISIONAL_UNCERTAINTY;
  }

  const fc = event.integrity?.field_confidence?.extracted_fact;
  if (fc?.user_confirmed) return 20;

  let score = DEFAULT_UNCERTAINTY;
  if (fc?.extraction === "high") score = 25;
  else if (fc?.extraction === "medium") score = 50;
  else if (fc?.extraction === "low") score = 80;

  score += Math.min(30, event.uncertainty.length * 8);

  if (event.event_time?.type === "unknown") score = Math.max(score, 75);
  else if (event.event_time?.type === "range" || event.event_time?.type === "approximate") {
    score = Math.max(score, 55);
  }

  return Math.min(100, Math.max(0, score));
}

export function deriveDependencyCount(
  event: CanonicalCareEvent,
  allEvents: CanonicalCareEvent[],
): number {
  if (allEvents.length <= 1) return DEFAULT_DEPENDENCY_COUNT;

  const rootId = event.root_event_id ?? event.id;
  const cluster = allEvents.filter(
    (e) =>
      e.id === rootId ||
      e.root_event_id === rootId ||
      (event.root_event_id && e.root_event_id === event.root_event_id),
  );

  const entityOverlap = allEvents.filter((e) => {
    if (e.id === event.id) return false;
    if (e.extracted_type !== event.extracted_type) return false;
    const labelsA = new Set(event.entities.map((en) => en.label.toLowerCase()));
    return e.entities.some((en) => labelsA.has(en.label.toLowerCase()));
  });

  return Math.max(DEFAULT_DEPENDENCY_COUNT, cluster.length, entityOverlap.length + 1);
}

export function toPriorityInput(
  event: CanonicalCareEvent,
  allEvents: CanonicalCareEvent[],
  reference = new Date(),
): CareEventPriorityInput {
  const attention_status = mapLifecycleToAttentionStatus(event.status);

  return {
    id: event.id,
    timestamp: event.timestamp,
    event_time: event.event_time?.start ?? null,
    uncertainty: deriveUncertaintyScore(event),
    urgency: deriveUrgency(event),
    dependency_count: deriveDependencyCount(event, allEvents),
    recency_days: computeRecencyDays(event.timestamp, reference),
    attention_status,
  };
}
