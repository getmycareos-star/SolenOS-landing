import type { EventAuditEntry, IntegrityCorrectionType } from "./types";

const auditLog = new Map<string, EventAuditEntry>();
const byEvent = new Map<string, string[]>();
const byCaregiver = new Map<string, string[]>();

function createAuditId(): string {
  return `audit_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function index(map: Map<string, string[]>, key: string, id: string): void {
  const list = map.get(key) ?? [];
  list.push(id);
  map.set(key, list);
}

export function appendAuditEntry(params: {
  event_id: string;
  caregiver_id: string;
  action: EventAuditEntry["action"];
  previous_snapshot?: Record<string, unknown> | null;
  updated_snapshot?: Record<string, unknown> | null;
  reason?: string | null;
  user_source?: string;
}): EventAuditEntry {
  const entry: EventAuditEntry = {
    id: createAuditId(),
    event_id: params.event_id,
    caregiver_id: params.caregiver_id,
    action: params.action,
    previous_snapshot: params.previous_snapshot ?? null,
    updated_snapshot: params.updated_snapshot ?? null,
    reason: params.reason ?? null,
    user_source: params.user_source ?? "user",
    created_at: new Date().toISOString(),
  };
  auditLog.set(entry.id, entry);
  index(byEvent, params.event_id, entry.id);
  index(byCaregiver, params.caregiver_id, entry.id);
  return entry;
}

export function getAuditTrailForEvent(eventId: string): EventAuditEntry[] {
  const ids = byEvent.get(eventId) ?? [];
  return ids.map((id) => auditLog.get(id)).filter((e): e is EventAuditEntry => e !== undefined);
}

export function listAuditForCaregiver(caregiverId: string): EventAuditEntry[] {
  const ids = byCaregiver.get(caregiverId) ?? [];
  return ids.map((id) => auditLog.get(id)).filter((e): e is EventAuditEntry => e !== undefined);
}

export function resetIntegrityAuditStore(): void {
  auditLog.clear();
  byEvent.clear();
  byCaregiver.clear();
}
