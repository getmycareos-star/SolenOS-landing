import { getAuditLogForRecipient } from "./store";
import type { AuditEntry } from "./types";

export function replayCareContextAt(
  careRecipientId: string,
  asOf: string,
): { entries: AuditEntry[]; entity_states: Map<string, Record<string, unknown>> } {
  const entries = getAuditLogForRecipient(careRecipientId).filter(
    (e) => e.timestamp <= asOf,
  );
  const entity_states = new Map<string, Record<string, unknown>>();

  for (const entry of entries.sort((a, b) => a.sequence - b.sequence)) {
    const key = `${entry.target.entity_type}:${entry.target.entity_id}`;
    if (entry.action_type === "delete") {
      entity_states.delete(key);
    } else if (entry.new_state) {
      entity_states.set(key, entry.new_state);
    }
  }

  return { entries, entity_states };
}

export function traceRecommendationToInputs(
  entityId: string,
  careRecipientId: string,
): AuditEntry[] {
  return getAuditLogForRecipient(careRecipientId).filter(
    (e) =>
      e.target.entity_id === entityId ||
      e.related_events.includes(entityId) ||
      e.related_audit_id !== null,
  );
}

export function isReplayable(careRecipientId: string): boolean {
  const entries = getAuditLogForRecipient(careRecipientId);
  return entries.length > 0 && entries.every((e) => e.audit_id && e.timestamp);
}
