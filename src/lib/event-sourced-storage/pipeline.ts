import {
  EVENT_SOURCED_STORAGE_DEFINING_PRINCIPLE,
  EVENT_SOURCED_STORAGE_RULES,
  STORAGE_LAYERS,
} from "./contract-constants";
import { rebuildDerivedTable } from "./derived-tables";
import { appendEvent } from "./event-store";
import { rebuildProjection } from "./projection-store";
import { upsertSessionRecord } from "./session-store";
import type {
  EventSourcedStorageResult,
  ProcessEventSourcedStorageInput,
} from "./types";

/**
 * Sync CareEvents into append-only Event Store and rebuild projection.
 * CareContext is a computed view — never mutated directly.
 */
export function processEventSourcedStorage(
  input: ProcessEventSourcedStorageInput,
): EventSourcedStorageResult {
  const asOf = input.as_of ?? new Date().toISOString();

  for (const event of input.events) {
    appendEvent({
      event_id: event.id,
      care_recipient_id: input.care_recipient_id,
      caregiver_id: input.caregiver_id,
      raw_observation: event.raw_input,
      normalized_type: event.extracted_type,
      source_id: input.caregiver_id,
      confidence: event.uncertainty.length > 0 ? 0.55 : 0.8,
      timestamp: event.ingestion_time,
      linked_entities: event.entities.map((e) => e.label),
    });
  }

  const projection = rebuildProjection({
    care_recipient_id: input.care_recipient_id,
    as_of: asOf,
  });

  rebuildDerivedTable(input.care_recipient_id, "type_histogram");

  const session = upsertSessionRecord({
    caregiver_id: input.caregiver_id,
    last_visit_at: asOf,
    event_count_at_visit: projection.rebuilt_from_event_count,
    engagement_state: projection.rebuilt_from_event_count <= 1 ? "new" : "active",
    last_projection_id: projection.projection_id,
    visit_count: undefined,
  });

  return {
    active: true,
    layers_present: [...STORAGE_LAYERS],
    event_count: projection.rebuilt_from_event_count,
    projection,
    session,
    can_rebuild_projection: true,
    mutation_blocked: true,
    rules_upheld: [...EVENT_SOURCED_STORAGE_RULES],
    defining_principle: EVENT_SOURCED_STORAGE_DEFINING_PRINCIPLE,
  };
}

export {
  appendEvent,
  getEventStream,
  getEventsUpTo,
  resetEventStore,
} from "./event-store";
export { getProjection, rebuildProjection, resetProjectionStore } from "./projection-store";
export { getSessionRecord, resetSessionStore, upsertSessionRecord } from "./session-store";
export { rebuildDerivedTable, resetDerivedTables } from "./derived-tables";
