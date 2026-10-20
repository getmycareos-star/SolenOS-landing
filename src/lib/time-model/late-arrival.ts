import { parseEventTimeFromText } from "./parse-event-time";
import type { EventTime } from "./types";

export type LateArrivalMatch = {
  action: "attach_to_existing" | "create_backdated";
  existing_event_id: string | null;
  event_time: EventTime;
  note: string;
};

export type ExistingTimedEvent = {
  id: string;
  raw_input: string;
  event_signal?: string;
  event_time: EventTime;
  ingestion_time: string;
};

function signalsMatch(a: string, b: string): boolean {
  const na = a.toLowerCase();
  const nb = b.toLowerCase();
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const fall = /\b(fell|fall|hospital|admitted)\b/i;
  return fall.test(a) && fall.test(b);
}

/**
 * Late-arriving document referring to past event:
 * attach to existing OR create backdated — never reorder ingestion history.
 */
export function resolveLateArrival(params: {
  documentText: string;
  ingestionTime: string;
  existingEvents: ExistingTimedEvent[];
}): LateArrivalMatch {
  const parsed = parseEventTimeFromText(params.documentText, params.ingestionTime);

  for (const existing of params.existingEvents) {
    if (
      signalsMatch(params.documentText, existing.raw_input) &&
      existing.event_time.type !== "unknown"
    ) {
      return {
        action: "attach_to_existing",
        existing_event_id: existing.id,
        event_time: existing.event_time,
        note: "Document attached to existing event — ingestion order preserved.",
      };
    }
  }

  return {
    action: "create_backdated",
    existing_event_id: null,
    event_time: parsed.event_time,
    note: "New event created with backdated event_time — ingestion_time is now.",
  };
}
