import { upsertCaregiver, buildSourceConfidenceProfiles } from "./caregivers";
import { detectPerspectiveConflicts } from "./conflicts";
import { fuseSharedReality } from "./fusion-engine";
import {
  MULTI_CAREGIVER_DEFINING_PRINCIPLE,
  MULTI_CAREGIVER_DESIGN_RULES,
  MULTI_CAREGIVER_PRIVACY_RULES,
} from "./contract-constants";
import {
  getRecipientContext,
  resolveCareRecipientId,
  saveRecipientContext,
  appendRecipientEvents,
  getRecipientEvents,
} from "./store";
import type {
  AttributionMapEntry,
  MultiCaregiverContextResult,
  ProcessMultiCaregiverContextInput,
} from "./types";

function mergeConflicts(
  existing: import("./types").MultiCaregiverConflict[],
  detected: import("./types").MultiCaregiverConflict[],
): import("./types").MultiCaregiverConflict[] {
  const byId = new Map(existing.map((c) => [c.conflict_id, c]));
  for (const c of detected) {
    if (!byId.has(c.conflict_id)) byId.set(c.conflict_id, c);
  }
  return [...byId.values()];
}

export function processMultiCaregiverContext(
  input: ProcessMultiCaregiverContextInput,
): MultiCaregiverContextResult {
  const asOf = input.as_of ?? new Date().toISOString();
  const careRecipientId = input.care_recipient_id ?? resolveCareRecipientId(input.caregiver_id);
  const ctx = getRecipientContext(careRecipientId);

  const caregivers = upsertCaregiver(ctx.caregivers, {
    caregiver_id: input.caregiver_id,
    name: input.caregiver_name,
    relationship_to_care_recipient: input.relationship_to_care_recipient,
    role: input.caregiver_role,
    as_of: asOf,
  });

  const newEntries: AttributionMapEntry[] = input.events_created
    .filter((e) => e.source_attribution)
    .map((e) => ({
      event_id: e.id,
      caregiver_id: e.source_attribution!.caregiver_id,
      care_recipient_id: e.source_attribution!.care_recipient_id,
      source_type: e.source_attribution!.source_type,
      recorded_at: e.ingestion_time,
    }));

  const attribution_map = [
    ...ctx.attribution_map.filter(
      (a) => !newEntries.some((n) => n.event_id === a.event_id),
    ),
    ...newEntries,
  ];

  appendRecipientEvents(careRecipientId, input.events_created);

  const recipientEventPool = getRecipientEvents(careRecipientId);
  const allAttributed = recipientEventPool.map((e) =>
    e.source_attribution
      ? e
      : {
          ...e,
          source_attribution: {
            caregiver_id: input.caregiver_id,
            care_recipient_id: careRecipientId,
            source_type: "inferred" as const,
            observed_at: e.ingestion_time,
            ingestion_context: null,
          },
        },
  );

  const detectedConflicts = detectPerspectiveConflicts(allAttributed, asOf);
  const conflict_log = mergeConflicts(ctx.conflict_log, detectedConflicts);
  const source_confidence_profiles = buildSourceConfidenceProfiles(caregivers, allAttributed);

  saveRecipientContext({
    care_recipient_id: careRecipientId,
    care_recipient_label: ctx.care_recipient_label,
    caregivers,
    attribution_map,
    source_confidence_profiles,
    conflict_log,
  });

  const clarification_needed = conflict_log
    .filter((c) => c.resolution_status === "open" || c.resolution_status === "preserved_both")
    .map((c) => c.shared_abstract_message)
    .slice(0, 3);

  const shared_reality = fuseSharedReality({
    care_recipient_id: careRecipientId,
    events: allAttributed,
    conflicts: conflict_log,
    what_changed: input.what_changed ?? [],
  });

  return {
    active: true,
    care_recipient_id: careRecipientId,
    shared_reality,
    attribution_internal_only: true,
    caregivers,
    attribution_map,
    source_confidence_profiles,
    conflict_log,
    events_attributed: newEntries.length,
    conflicts_detected: detectedConflicts.length,
    attribution_enforced: input.events_created.every(
      (e) => e.source_attribution !== undefined,
    ),
    clarification_needed,
    rules_upheld: [...MULTI_CAREGIVER_DESIGN_RULES, ...MULTI_CAREGIVER_PRIVACY_RULES],
    defining_principle: MULTI_CAREGIVER_DEFINING_PRINCIPLE,
  };
}
