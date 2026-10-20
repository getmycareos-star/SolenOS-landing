import { DEDUP_WINDOW_MS, RECENT_EVENT_DAYS } from "./contract-constants";
import {
  normalizeDosage,
  normalizeMedicationName,
  semanticFactKey,
} from "./event-mapper";
import type {
  CareRecord,
  CareTimeline,
  MedicalFact,
  PatientState,
  TimelineConflict,
  TimelineEvent,
} from "./types";

function createFactId(type: string, name: string): string {
  return `fact_${type}_${normalizeMedicationName(name).replace(/\s+/g, "_")}`;
}

function eventToFacts(event: TimelineEvent): MedicalFact[] {
  const facts: MedicalFact[] = [];
  const now = event.timestamp;

  if (event.type === "medication_started" || event.type === "medication_changed") {
    const med = event.extracted_entities.medication;
    if (typeof med === "string") {
      const dosage =
        typeof event.extracted_entities.dosage === "string"
          ? normalizeDosage(event.extracted_entities.dosage)
          : undefined;
      facts.push({
        id: createFactId("medication", med),
        type: "medication",
        name: normalizeMedicationName(med),
        state: {
          value: dosage,
          status: "active",
        },
        provenance: [event.id],
        last_updated: now,
      });
    }
  }

  if (event.type === "symptom_reported") {
    const symptoms = event.extracted_entities.symptoms;
    const list = Array.isArray(symptoms) ? symptoms : symptoms ? [symptoms] : ["unspecified symptom"];
    for (const sym of list) {
      facts.push({
        id: createFactId("symptom", sym),
        type: "symptom",
        name: sym,
        state: { status: "active" },
        provenance: [event.id],
        last_updated: now,
      });
    }
  }

  if (event.type === "doctor_instruction") {
    facts.push({
      id: createFactId("condition", "doctor_instruction"),
      type: "condition",
      name: "clinical instruction",
      state: { value: event.abstract_label, status: "active" },
      provenance: [event.id],
      last_updated: now,
    });
  }

  return facts;
}

function mergeFact(existing: MedicalFact, incoming: MedicalFact): MedicalFact {
  return {
    ...existing,
    state: {
      ...existing.state,
      ...incoming.state,
      value: incoming.state.value ?? existing.state.value,
    },
    provenance: [...new Set([...existing.provenance, ...incoming.provenance])],
    last_updated: incoming.last_updated > existing.last_updated ? incoming.last_updated : existing.last_updated,
  };
}

function withinDedupWindow(a: string, b: string): boolean {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) <= DEDUP_WINDOW_MS;
}

function deduplicateFacts(facts: MedicalFact[]): { facts: MedicalFact[]; merged_count: number } {
  const byKey = new Map<string, MedicalFact>();
  let merged_count = 0;

  for (const fact of facts) {
    const key = semanticFactKey(fact.type, fact.name);
    const existing = byKey.get(key);
    if (existing && withinDedupWindow(existing.last_updated, fact.last_updated)) {
      byKey.set(key, mergeFact(existing, fact));
      merged_count += 1;
    } else if (!existing) {
      byKey.set(key, fact);
    } else {
      byKey.set(`${key}_${fact.id}`, fact);
    }
  }

  return { facts: [...byKey.values()], merged_count };
}

function detectMedicationConflicts(events: TimelineEvent[]): TimelineConflict[] {
  const conflicts: TimelineConflict[] = [];
  const medEvents = events.filter(
    (e) => e.type === "medication_started" || e.type === "medication_changed",
  );

  for (let i = 0; i < medEvents.length; i++) {
    for (let j = i + 1; j < medEvents.length; j++) {
      const a = medEvents[i]!;
      const b = medEvents[j]!;
      const medA = a.extracted_entities.medication;
      const medB = b.extracted_entities.medication;
      if (typeof medA !== "string" || typeof medB !== "string") continue;
      if (normalizeMedicationName(medA) !== normalizeMedicationName(medB)) continue;

      const doseA = a.extracted_entities.dosage;
      const doseB = b.extracted_entities.dosage;
      const changeA = /\b(increased|changed|reduced)\b/i.test(a.source.raw_text);
      const changeB = /\b(unchanged|same|no change)\b/i.test(b.source.raw_text);

      if (
        (changeA && changeB) ||
        (typeof doseA === "string" && typeof doseB === "string" && normalizeDosage(doseA) !== normalizeDosage(doseB))
      ) {
        conflicts.push({
          conflict_id: `conflict_${a.id}_${b.id}`,
          type: "contradiction",
          field: `medication.${normalizeMedicationName(medA)}.dosage`,
          related_events: [a.id, b.id],
          status: "unresolved",
          shared_message: `Conflicting reports on ${normalizeMedicationName(medA)} dosage or change`,
        });
      }
    }
  }

  return conflicts;
}

function buildEvidenceGraph(facts: MedicalFact[]): Record<string, string[]> {
  const graph: Record<string, string[]> = {};
  for (const fact of facts) {
    graph[fact.id] = [...fact.provenance];
  }
  return graph;
}

function derivePatientState(timeline: CareTimeline, asOf: string): PatientState {
  const cutoff = new Date(asOf);
  cutoff.setDate(cutoff.getDate() - RECENT_EVENT_DAYS);

  return {
    active_medications: timeline.facts.filter((f) => f.type === "medication" && f.state.status === "active"),
    active_conditions: timeline.facts.filter((f) => f.type === "condition" && f.state.status === "active"),
    active_symptoms: timeline.facts.filter((f) => f.type === "symptom" && f.state.status === "active"),
    recent_events: timeline.events.filter((e) => new Date(e.timestamp) >= cutoff),
    open_issues: timeline.conflicts.filter((c) => c.status === "unresolved"),
    last_updated: timeline.last_updated,
  };
}

/** Pure state reducer — CareTimeline(t+1) = Reduce(CareTimeline(t), Event) */
export function reduceCareTimeline(timeline: CareTimeline, event: TimelineEvent): CareTimeline {
  const events = [...timeline.events, event].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const newFacts = eventToFacts(event);
  const allFacts = deduplicateFacts([...timeline.facts, ...newFacts]).facts;
  const conflicts = [
    ...timeline.conflicts,
    ...detectMedicationConflicts(events).filter(
      (c) => !timeline.conflicts.some((existing) => existing.conflict_id === c.conflict_id),
    ),
  ];

  return {
    ...timeline,
    events,
    facts: allFacts,
    conflicts,
    evidence_graph: buildEvidenceGraph(allFacts),
    last_updated: event.timestamp,
  };
}

export function buildCareTimelineFromEvents(
  patientId: string,
  timelineEvents: TimelineEvent[],
  asOf: string,
): CareRecord {
  let timeline: CareTimeline = {
    patient_id: patientId,
    events: [],
    facts: [],
    conflicts: [],
    evidence_graph: {},
    last_updated: asOf,
  };

  for (const event of timelineEvents.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  )) {
    timeline = reduceCareTimeline(timeline, event);
  }

  const patient_state = derivePatientState(timeline, asOf);

  return { ...timeline, patient_state };
}

export { deduplicateFacts, derivePatientState, buildEvidenceGraph };
