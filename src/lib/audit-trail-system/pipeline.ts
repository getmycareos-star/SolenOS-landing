import {
  AUDIT_IMMUTABILITY_RULES,
  AUDIT_TRAIL_DEFINING_PRINCIPLE,
  AUDIT_TRAIL_IDENTITY,
} from "./contract-constants";
import { getAuditLogForRecipient, getAuditLog } from "./store";
import { isReplayable } from "./replay";
import type { AuditTrailResult } from "./types";

export function processAuditTrail(input: {
  care_recipient_id: string;
  events_created_count: number;
}): AuditTrailResult {
  const recipientLog = getAuditLogForRecipient(input.care_recipient_id);
  const total = getAuditLog().length;

  return {
    active: true,
    entries_recorded: input.events_created_count,
    total_entries: total,
    care_recipient_id: input.care_recipient_id,
    replayable: isReplayable(input.care_recipient_id),
    latest_sequence: recipientLog[recipientLog.length - 1]?.sequence ?? 0,
    conflict_entries: recipientLog.filter((e) => e.conflict_relationship !== null).length,
    rules_upheld: [...AUDIT_IMMUTABILITY_RULES],
    defining_principle: AUDIT_TRAIL_DEFINING_PRINCIPLE,
  };
}

export { AUDIT_TRAIL_IDENTITY };
