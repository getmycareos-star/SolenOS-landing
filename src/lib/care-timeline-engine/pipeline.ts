import {
  CARE_TIMELINE_DEFINING_PRINCIPLE,
  CARE_TIMELINE_RULES,
} from "./contract-constants";
import { mapCanonicalToTimelineEvent } from "./event-mapper";
import { buildCareTimelineFromEvents } from "./reduce";
import { storeCareRecord } from "./store";
import type {
  CareTimelineEngineResult,
  CareTruth,
  ProcessCareTimelineEngineInput,
} from "./types";

export function processCareTimelineEngine(
  input: ProcessCareTimelineEngineInput,
): CareTimelineEngineResult {
  const asOf = input.as_of ?? new Date().toISOString();

  const timelineEvents = input.events
    .map(mapCanonicalToTimelineEvent)
    .filter((e): e is NonNullable<typeof e> => e !== null);

  const care_record = buildCareTimelineFromEvents(
    input.care_recipient_id,
    timelineEvents,
    asOf,
  );

  for (const conflict of input.multi_caregiver?.conflict_log ?? []) {
    const existing = care_record.conflicts.some((c) => c.field.includes(conflict.contradiction_type));
    if (!existing) {
      care_record.conflicts.push({
        conflict_id: conflict.conflict_id,
        type: "contradiction",
        field: conflict.contradiction_type,
        related_events: conflict.event_ids.map((id) => `tl_${id}`),
        status: conflict.resolution_status === "resolved" ? "resolved" : "unresolved",
        shared_message: conflict.shared_abstract_message,
      });
    }
  }

  care_record.patient_state.open_issues = care_record.conflicts.filter((c) => c.status === "unresolved");
  storeCareRecord(care_record);

  const care_truth: CareTruth = {
    current_state: care_record.patient_state,
    timeline: care_record.events,
    facts: care_record.facts,
    conflicts: care_record.conflicts,
    evidence_graph: care_record.evidence_graph,
  };

  const facts_deduplicated = Math.max(0, timelineEvents.length - care_record.facts.length);

  return {
    active: true,
    care_record,
    care_truth,
    events_processed: input.events_created.length,
    facts_deduplicated,
    conflicts_detected: care_record.conflicts.length,
    rules_upheld: [...CARE_TIMELINE_RULES],
    defining_principle: CARE_TIMELINE_DEFINING_PRINCIPLE,
  };
}
