import type { CareEventTimeCorrection, EventTime, RetimingReason } from "./types";

const corrections = new Map<string, CareEventTimeCorrection[]>();

export function createRetimingCorrectionId(): string {
  return `tc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Re-time an event — NEVER overwrite silently.
 * ingestion_time remains immutable; only event_time updates.
 */
export function applyEventTimeCorrection(params: {
  eventId: string;
  previousEventTime: EventTime;
  updatedEventTime: EventTime;
  reason: RetimingReason;
}): CareEventTimeCorrection {
  const correction: CareEventTimeCorrection = {
    id: createRetimingCorrectionId(),
    original_event_id: params.eventId,
    previous_event_time: params.previousEventTime,
    updated_event_time: params.updatedEventTime,
    reason: params.reason,
    corrected_at: new Date().toISOString(),
  };

  const list = corrections.get(params.eventId) ?? [];
  list.push(correction);
  corrections.set(params.eventId, list);
  return correction;
}

export function getTimeCorrectionsForEvent(eventId: string): CareEventTimeCorrection[] {
  return corrections.get(eventId) ?? [];
}

export function applyRetrospectiveUpdate(params: {
  eventId: string;
  currentEventTime: EventTime;
  newEventTime: EventTime;
}): { updated_event_time: EventTime; correction: CareEventTimeCorrection } {
  const correction = applyEventTimeCorrection({
    eventId: params.eventId,
    previousEventTime: params.currentEventTime,
    updatedEventTime: params.newEventTime,
    reason: "retrospective_update",
  });
  return { updated_event_time: params.newEventTime, correction };
}

export function resetTimeCorrectionStore(): void {
  corrections.clear();
}
