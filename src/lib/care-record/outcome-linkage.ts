import { getCareEvent, updateCareEventMetadata } from "@/lib/care-events";
import type { OutcomeStatus } from "./types";

export function recordEventOutcome(params: {
  event_id: string;
  status: OutcomeStatus;
  summary: string;
}): { ok: true } | { ok: false; error: string } {
  const event = getCareEvent(params.event_id);
  if (!event) return { ok: false, error: "Event not found" };

  const now = new Date().toISOString();
  const structured = event.metadata.structured;
  const nextStructured =
    structured && typeof structured === "object"
      ? {
          ...(structured as Record<string, unknown>),
          outcome: {
            status: params.status,
            summary: params.summary,
            recorded_at: now,
          },
        }
      : {
          outcome: {
            status: params.status,
            summary: params.summary,
            recorded_at: now,
          },
        };

  updateCareEventMetadata(params.event_id, {
    structured: nextStructured,
    outcome_recorded_at: now,
  });

  return { ok: true };
}

export function linkOutcomeEvent(params: {
  parent_event_id: string;
  outcome_content: string;
  status: OutcomeStatus;
  caregiver_id?: string;
}): { ok: false; error: string } | { ok: true; outcome_event_id: string } {
  const parent = getCareEvent(params.parent_event_id);
  if (!parent) return { ok: false, error: "Parent event not found" };

  // Outcome events are recorded via care-events API; this updates parent linkage
  recordEventOutcome({
    event_id: params.parent_event_id,
    status: params.status,
    summary: params.outcome_content,
  });

  const related = Array.isArray(parent.metadata.related_outcome_ids)
    ? (parent.metadata.related_outcome_ids as string[])
    : [];

  updateCareEventMetadata(params.parent_event_id, {
    related_outcome_ids: related,
    relationship: "event_decision_outcome",
  });

  return { ok: true, outcome_event_id: params.parent_event_id };
}
