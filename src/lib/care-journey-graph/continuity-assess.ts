import { EVENT_TYPE_LABELS } from "./classify-event";
import type {
  ContinuityAssessment,
  ContinuityPattern,
  JourneyGraphEvent,
  JourneyRelationship,
} from "./types";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

export function assessContinuity(params: {
  newEvent: JourneyGraphEvent;
  priorEvents: JourneyGraphEvent[];
  relationships: JourneyRelationship[];
  completeness_status: string;
  missing_signals: string[];
}): ContinuityAssessment {
  const { newEvent, priorEvents, relationships, completeness_status, missing_signals } = params;

  const linked_to_existing = relationships.length > 0;
  const what_changed_since_last: string[] = [];
  const patterns_detected: ContinuityPattern[] = [];
  const continuity_notes: string[] = [];
  const suggested_connection_questions: string[] = [];
  const open_questions = [...newEvent.open_questions];
  const unresolved_items: string[] = [];

  if (priorEvents.length > 0) {
    const last = priorEvents[0]!;
    if (last.event_type !== newEvent.event_type || last.description !== newEvent.description) {
      what_changed_since_last.push(
        `Since ${formatDate(last.timestamp)} (${EVENT_TYPE_LABELS[last.event_type]}): ${last.title}`,
      );
      what_changed_since_last.push(
        `Now (${formatDate(newEvent.timestamp)}): ${newEvent.title}`,
      );
    }
  }

  for (const rel of relationships) {
    const from = priorEvents.find((e) => e.id === rel.from_event_id);
    if (!from) continue;

    patterns_detected.push({
      pattern_note: `${formatDate(from.timestamp)} — ${EVENT_TYPE_LABELS[from.event_type]} ${rel.relationship_type.replace(/_/g, " ")} ${EVENT_TYPE_LABELS[newEvent.event_type]}: ${rel.note}`,
      event_ids: [from.id, newEvent.id],
      confidence: "evidence_backed",
    });
  }

  // Appetite / medication / confusion continuity questions
  if (newEvent.event_type === "symptom" || newEvent.event_type === "behaviour_change") {
    const hasMedChange = priorEvents.some((e) =>
      ["medication_started", "medication_stopped"].includes(e.event_type),
    );
    const hasHospital = priorEvents.some((e) => e.event_type === "hospital_visit");
    const hasAppetite = priorEvents.some((e) => /\b(appetite|eating)\b/i.test(e.description));

    if (hasMedChange) suggested_connection_questions.push("Is this connected to a recent medication change?");
    if (hasHospital) suggested_connection_questions.push("Is this connected to a recent hospital discharge?");
    if (hasAppetite) suggested_connection_questions.push("Is this a continuation of previous appetite decline?");
    if (!hasMedChange && !hasHospital && !hasAppetite) {
      suggested_connection_questions.push("Is this connected to a new illness, pain, or difficulty swallowing?");
    }
  }

  if (linked_to_existing) {
    continuity_notes.push("This event was linked to existing journey context — not recorded as an isolated note.");
  } else if (priorEvents.length > 0) {
    continuity_notes.push("No strong link to prior events detected yet.");
  }

  if (completeness_status === "INSUFFICIENT") {
    continuity_notes.push(
      "Additional information is needed before assessing urgency. Unable to determine priority.",
    );
    open_questions.push(...missing_signals.map((m) => `Can you clarify: ${m}?`));
  }

  for (const e of priorEvents) {
    if (e.resolved_status === "open" && e.event_type === "doctor_recommendation") {
      unresolved_items.push(`Open recommendation from ${formatDate(e.timestamp)}: ${e.title}`);
    }
  }

  return {
    what_changed_since_last,
    patterns_detected,
    open_questions: [...new Set(open_questions)].slice(0, 5),
    unresolved_items: unresolved_items.slice(0, 5),
    continuity_notes,
    linked_to_existing,
    suggested_connection_questions: suggested_connection_questions.slice(0, 5),
  };
}
