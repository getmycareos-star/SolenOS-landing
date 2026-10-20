import type { AuditEntry } from "./types";

const log: AuditEntry[] = [];
const byRecipient = new Map<string, AuditEntry[]>();
let sequenceCounter = 0;

export function appendAuditEntry(entry: AuditEntry): AuditEntry {
  log.push(entry);
  const list = byRecipient.get(entry.care_recipient_id) ?? [];
  byRecipient.set(entry.care_recipient_id, [...list, entry]);
  return entry;
}

export function getAuditLog(): readonly AuditEntry[] {
  return log;
}

export function getAuditLogForRecipient(careRecipientId: string): AuditEntry[] {
  return byRecipient.get(careRecipientId) ?? [];
}

export function nextSequence(): number {
  sequenceCounter += 1;
  return sequenceCounter;
}

export function resetAuditTrailStore(): void {
  log.length = 0;
  byRecipient.clear();
  sequenceCounter = 0;
}
