import { getAuditTrailForEvent, listAuditForCaregiver } from "../care-event-integrity";
import type { EventAuditEntry } from "../care-event-integrity/types";
import type { AuditTrailSummary } from "./types";

function fieldFromSnapshot(
  snapshot: Record<string, unknown> | null,
  field: string,
): string | null {
  if (!snapshot) return null;
  const val = snapshot[field];
  if (val === undefined || val === null) return null;
  return typeof val === "string" ? val : JSON.stringify(val);
}

function summarizeAuditEntry(entry: EventAuditEntry): AuditTrailSummary[] {
  const summaries: AuditTrailSummary[] = [];

  if (entry.action === "modify" || entry.action === "retime" || entry.action === "confirm") {
    summaries.push({
      event_id: entry.event_id,
      field_label:
        entry.action === "retime"
          ? "Event time"
          : entry.action === "confirm"
            ? "Extracted fact"
            : "Field value",
      original_value: fieldFromSnapshot(entry.previous_snapshot, "raw_input") ??
        fieldFromSnapshot(entry.previous_snapshot, "event_time") ??
        (entry.previous_snapshot ? JSON.stringify(entry.previous_snapshot).slice(0, 80) : null),
      updated_value: fieldFromSnapshot(entry.updated_snapshot, "raw_input") ??
        fieldFromSnapshot(entry.updated_snapshot, "event_time") ??
        (entry.updated_snapshot ? JSON.stringify(entry.updated_snapshot).slice(0, 80) : null),
      changed_by: entry.user_source,
      changed_at: entry.created_at,
      reason: entry.reason,
    });
  }

  if (entry.action === "invalidate" || entry.action === "supersede") {
    summaries.push({
      event_id: entry.event_id,
      field_label: "Status",
      original_value: fieldFromSnapshot(entry.previous_snapshot, "status") ?? "active",
      updated_value: entry.action === "invalidate" ? "invalidated" : "superseded",
      changed_by: entry.user_source,
      changed_at: entry.created_at,
      reason: entry.reason,
    });
  }

  return summaries;
}

export function buildAuditTrailSummary(eventIds: string[]): AuditTrailSummary[] {
  const summaries: AuditTrailSummary[] = [];
  for (const eventId of eventIds) {
    for (const entry of getAuditTrailForEvent(eventId)) {
      summaries.push(...summarizeAuditEntry(entry));
    }
  }
  return summaries;
}

export function buildCaregiverAuditSummary(caregiverId: string): AuditTrailSummary[] {
  return listAuditForCaregiver(caregiverId).flatMap(summarizeAuditEntry);
}

export function formatAuditChange(summary: AuditTrailSummary): string {
  const parts = [summary.field_label];
  if (summary.original_value) parts.push(`Original: ${summary.original_value}`);
  if (summary.updated_value) parts.push(`Updated: ${summary.updated_value}`);
  parts.push(`Changed by: ${summary.changed_by}`);
  if (summary.reason) parts.push(`Reason: ${summary.reason}`);
  return parts.join(" — ");
}
