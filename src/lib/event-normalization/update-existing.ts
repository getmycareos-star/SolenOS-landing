import type { NormalizedAtomicEvent } from "./types";

const MED_START = /\b(medication started|started medication|prescribed|began)\b/i;
const MED_CHANGE = /\b(dose increased|dose decreased|increased dose|changed dose|medication changed)\b/i;

/** Update existing medication event instead of creating unrelated duplicate. */
export function applyMedicationUpdateRule(
  incoming: NormalizedAtomicEvent[],
  existing: NormalizedAtomicEvent[],
): {
  toCommit: NormalizedAtomicEvent[];
  updated: { event: NormalizedAtomicEvent; description: string }[];
} {
  const toCommit: NormalizedAtomicEvent[] = [];
  const updated: { event: NormalizedAtomicEvent; description: string }[] = [];

  for (const event of incoming) {
    if (!MED_CHANGE.test(event.source_text) && event.atomic_type !== "medication_changed") {
      toCommit.push(event);
      continue;
    }

    const priorMed = [...existing, ...toCommit]
      .reverse()
      .find(
        (e) =>
          (e.atomic_type === "medication_started" || e.atomic_type === "medication_changed") &&
          (MED_START.test(e.source_text + e.label) || e.attributes.medication_started),
      );

    if (priorMed) {
      const changes = Array.isArray(priorMed.attributes.medication_changes)
        ? [...(priorMed.attributes.medication_changes as unknown[])]
        : [];
      changes.push({
        change: event.source_text,
        recorded_at: event.timestamp,
        confidence: event.confidence,
      });

      const updatedEvent: NormalizedAtomicEvent = {
        ...priorMed,
        atomic_type: "medication_changed",
        status: "updated",
        updated_event_id: priorMed.id,
        attributes: {
          ...priorMed.attributes,
          medication_changes: changes,
          last_change: event.source_text,
        },
        confidence: Math.max(priorMed.confidence, event.confidence),
      };

      updated.push({
        event: updatedEvent,
        description: `Updated medication event with change: ${event.source_text.slice(0, 60)}`,
      });
    } else {
      toCommit.push(event);
    }
  }

  return { toCommit, updated };
}
