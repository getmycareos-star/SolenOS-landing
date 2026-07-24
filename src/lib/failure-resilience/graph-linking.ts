import type { CanonicalCareEvent } from "../situation-entry/types";
import type { FailureRecord, RelationshipStatus } from "./types";

const APPOINTMENT_REF = /\b(the appointment|that appointment|follow[- ]?up|the visit)\b/i;
const VAGUE_EVERYTHING = /\b(everything|all of it|that|this)\b/i;

function createFailureId(): string {
  return `fr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Detect graph linking failures — do not create uncertain relationships. */
export function detectGraphLinkingFailures(
  newEvents: CanonicalCareEvent[],
  existingEvents: CanonicalCareEvent[],
): FailureRecord[] {
  const failures: FailureRecord[] = [];
  const all = [...existingEvents, ...newEvents];

  const appointments = all.filter(
    (e) =>
      e.extracted_type === "follow_up" ||
      /\b(appointment|visit|follow[- ]?up)\b/i.test(e.raw_input),
  );

  for (const event of newEvents) {
    if (APPOINTMENT_REF.test(event.raw_input) && appointments.length > 1) {
      failures.push({
        id: createFailureId(),
        category: "graph_linking_failure",
        outcome: "clarify",
        message:
          "This references an appointment, but multiple appointments exist — kept independent until clarified.",
        raw_input_id: String(event.attributes.raw_input_id ?? "") || null,
        event_id: event.id,
        extracted_partial: [event.raw_input],
        not_understood: ["Which appointment does this refer to?"],
        clarification_questions: [
          "Which appointment does this refer to?",
          ...appointments.slice(0, 3).map((a) => `Option: ${a.raw_input.slice(0, 60)}`),
        ],
        possible_interpretations: appointments.map((a) => a.raw_input.slice(0, 80)),
        relationship_status: "unresolved" satisfies RelationshipStatus,
        conflict_id: null,
        recoverable: true,
        created_at: new Date().toISOString(),
      });
    }

    if (VAGUE_EVERYTHING.test(event.raw_input) && event.uncertainty.length > 0) {
      failures.push({
        id: createFailureId(),
        category: "ambiguous_interpretation",
        outcome: "clarify",
        message: "Multiple valid interpretations possible — graph update deferred.",
        raw_input_id: String(event.attributes.raw_input_id ?? "") || null,
        event_id: event.id,
        extracted_partial: [event.raw_input],
        not_understood: ["What specifically changed?"],
        clarification_questions: ["What specifically changed?", "What does 'everything' refer to?"],
        possible_interpretations: [
          "Medication changes",
          "Care routine changes",
          "Living situation changes",
          "Schedule changes",
        ],
        relationship_status: "deferred",
        conflict_id: null,
        recoverable: true,
        created_at: new Date().toISOString(),
      });
    }
  }

  return failures;
}

export function markEventRelationshipStatus(
  event: CanonicalCareEvent,
  status: RelationshipStatus,
): CanonicalCareEvent {
  return {
    ...event,
    attributes: {
      ...event.attributes,
      relationship_status: status,
    },
  };
}
