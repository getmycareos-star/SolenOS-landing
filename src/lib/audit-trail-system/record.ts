import { appendAuditEntry, nextSequence } from "./store";
import type { AuditEntry, RecordAuditInput } from "./types";

function createAuditId(): string {
  return `audit_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function recordAudit(input: RecordAuditInput): AuditEntry {
  const entry: AuditEntry = {
    audit_id: createAuditId(),
    timestamp: input.timestamp ?? new Date().toISOString(),
    sequence: nextSequence(),
    care_recipient_id: input.care_recipient_id,
    actor: input.actor,
    action_type: input.action_type,
    target: { entity_type: input.entity_type, entity_id: input.entity_id },
    previous_state: input.previous_state ?? null,
    new_state: input.new_state ?? null,
    reason: input.reason,
    reason_detail: input.reason_detail ?? null,
    confidence_before: input.confidence_before ?? null,
    confidence_after: input.confidence_after ?? null,
    related_events: input.related_events ?? [],
    related_audit_id: input.related_audit_id ?? null,
    conflict_relationship: input.conflict_relationship ?? null,
  };

  return appendAuditEntry(entry);
}

export function recordCareEventCreate(input: {
  event_id: string;
  caregiver_id: string;
  care_recipient_id: string;
  snapshot: Record<string, unknown>;
  timestamp?: string;
  reason?: import("./types").AuditReason;
  confidence_after?: number | null;
}): AuditEntry {
  return recordAudit({
    actor: { type: "caregiver", id: input.caregiver_id },
    action_type: "create",
    entity_type: "care_event",
    entity_id: input.event_id,
    previous_state: null,
    new_state: input.snapshot,
    reason: input.reason ?? "explicit_user_input",
    confidence_after: input.confidence_after,
    related_events: [input.event_id],
    care_recipient_id: input.care_recipient_id,
    timestamp: input.timestamp,
  });
}

export function recordCareEventUpdate(input: {
  event_id: string;
  actor_id: string;
  actor_type?: import("./types").AuditActor["type"];
  care_recipient_id: string;
  previous_state: Record<string, unknown>;
  new_state: Record<string, unknown>;
  reason: import("./types").AuditReason;
  reason_detail?: string;
  confidence_before?: number | null;
  confidence_after?: number | null;
  conflict_relationship?: import("./types").ConflictRelationship | null;
  related_audit_id?: string | null;
}): AuditEntry {
  return recordAudit({
    actor: { type: input.actor_type ?? "caregiver", id: input.actor_id },
    action_type: input.conflict_relationship ? "merge" : "update",
    entity_type: "care_event",
    entity_id: input.event_id,
    previous_state: input.previous_state,
    new_state: input.new_state,
    reason: input.reason,
    reason_detail: input.reason_detail,
    confidence_before: input.confidence_before,
    confidence_after: input.confidence_after,
    related_events: [input.event_id],
    conflict_relationship: input.conflict_relationship,
    related_audit_id: input.related_audit_id,
    care_recipient_id: input.care_recipient_id,
  });
}
