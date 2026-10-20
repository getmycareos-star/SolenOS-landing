import type { CanonicalCareEvent } from "../situation-entry/types";
import { appendAuditEntry } from "./audit-store";
import { markSuperseded, markUserCorrected, attachAuditId } from "./lifecycle";
import type { CareEventLifecycleStatus } from "./types";

export function snapshotEvent(event: CanonicalCareEvent): Record<string, unknown> {
  return {
    raw_input: event.raw_input,
    extracted_type: event.extracted_type,
    status: event.status,
    event_time: event.event_time,
    entities: event.entities,
    attributes: event.attributes,
  };
}

/** Soft delete — status invalidated, never hard removed. */
export function invalidateCanonicalEvent(
  event: CanonicalCareEvent,
  caregiverId: string,
  reason?: string,
): CanonicalCareEvent {
  const audit = appendAuditEntry({
    event_id: event.id,
    caregiver_id: caregiverId,
    action: "invalidate",
    previous_snapshot: snapshotEvent(event),
    updated_snapshot: { status: "invalidated" },
    reason: reason ?? "user_correction",
  });

  return {
    ...event,
    status: "invalidated",
    integrity: attachAuditId(event.integrity, audit.id),
  };
}

/** User correction wins — AI version superseded, replacement committed. */
export function supersedeWithUserVersion(params: {
  original: CanonicalCareEvent;
  replacement: CanonicalCareEvent;
  caregiverId: string;
  reason?: string;
}): { superseded: CanonicalCareEvent; active: CanonicalCareEvent } {
  const audit = appendAuditEntry({
    event_id: params.original.id,
    caregiver_id: params.caregiverId,
    action: "supersede",
    previous_snapshot: snapshotEvent(params.original),
    updated_snapshot: snapshotEvent(params.replacement),
    reason: params.reason ?? "user_correction",
  });

  const superseded: CanonicalCareEvent = {
    ...params.original,
    status: "superseded",
    integrity: markSuperseded(params.original.integrity, params.replacement.id, audit.id),
  };

  const active: CanonicalCareEvent = {
    ...params.replacement,
    status: "committed",
    integrity: {
      ...markUserCorrected(params.replacement.integrity),
      supersedes_id: params.original.id,
      audit_trail_ids: [...params.replacement.integrity.audit_trail_ids, audit.id],
    },
  };

  return { superseded, active };
}

export function applyUserFieldEdit(params: {
  event: CanonicalCareEvent;
  caregiverId: string;
  fields: Record<string, unknown>;
  reason?: string;
}): CanonicalCareEvent {
  const audit = appendAuditEntry({
    event_id: params.event.id,
    caregiver_id: params.caregiverId,
    action: "modify",
    previous_snapshot: snapshotEvent(params.event),
    updated_snapshot: params.fields,
    reason: params.reason ?? "user_correction",
  });

  const updated: CanonicalCareEvent = {
    ...params.event,
    status: params.event.status === "provisional" ? "committed" : params.event.status,
    raw_input:
      typeof params.fields.extracted_fact === "string"
        ? params.fields.extracted_fact
        : typeof params.fields.raw_input === "string"
          ? params.fields.raw_input
          : params.event.raw_input,
    attributes: {
      ...params.event.attributes,
      ...Object.fromEntries(
        Object.entries(params.fields).map(([k, v]) => [
          k,
          typeof v === "string" || typeof v === "boolean" || v === null
            ? v
            : Array.isArray(v)
              ? v.map(String)
              : String(v),
        ]),
      ),
    },
    integrity: attachAuditId(markUserCorrected(params.event.integrity), audit.id),
  };

  return updated;
}

export function filterActiveEvents(events: CanonicalCareEvent[]): CanonicalCareEvent[] {
  return events.filter(
    (e) => e.status !== "invalidated" && e.status !== "superseded",
  );
}

export function filterByStatus(
  events: CanonicalCareEvent[],
  statuses: CareEventLifecycleStatus[],
): CanonicalCareEvent[] {
  return events.filter((e) => statuses.includes(e.status));
}
