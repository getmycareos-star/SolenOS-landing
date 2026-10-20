import type { CaseEvent } from "../types";

/** In-memory event timeline keyed by caseId — durable Case timeline (WHAT), not chat history. */
const eventsByCaseId = new Map<string, CaseEvent[]>();

export function resetEventTimelineStore(): void {
  eventsByCaseId.clear();
}

export function listEventsForCase(caseId: string): readonly CaseEvent[] {
  return [...(eventsByCaseId.get(caseId) ?? [])];
}

export function appendCaseEvent(event: CaseEvent): CaseEvent {
  const list = eventsByCaseId.get(event.caseId) ?? [];
  list.push(event);
  list.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  eventsByCaseId.set(event.caseId, list);
  return event;
}

export function replaceEventsForCase(caseId: string, events: CaseEvent[]): void {
  eventsByCaseId.set(
    caseId,
    [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
  );
}

export function getEvent(caseId: string, eventId: string): CaseEvent | undefined {
  return (eventsByCaseId.get(caseId) ?? []).find((e) => e.id === eventId);
}

export function countEventsForCase(caseId: string): number {
  return (eventsByCaseId.get(caseId) ?? []).length;
}

export function createEventId(): string {
  return `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
