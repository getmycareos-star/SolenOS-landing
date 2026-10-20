import type {
  AUDIT_ACTION_TYPES,
  AUDIT_ACTORS,
  AUDIT_REASONS,
  CONFLICT_RELATIONSHIPS,
} from "./contract-constants";

export type AuditActorType = (typeof AUDIT_ACTORS)[number];
export type AuditActionType = (typeof AUDIT_ACTION_TYPES)[number];
export type AuditReason = (typeof AUDIT_REASONS)[number];
export type ConflictRelationship = (typeof CONFLICT_RELATIONSHIPS)[number];

export type AuditActor = {
  type: AuditActorType;
  id: string;
};

export type AuditEntry = {
  audit_id: string;
  timestamp: string;
  sequence: number;
  care_recipient_id: string;
  actor: AuditActor;
  action_type: AuditActionType;
  target: {
    entity_type: string;
    entity_id: string;
  };
  previous_state: Record<string, unknown> | null;
  new_state: Record<string, unknown> | null;
  reason: AuditReason;
  reason_detail: string | null;
  confidence_before: number | null;
  confidence_after: number | null;
  related_events: string[];
  related_audit_id: string | null;
  conflict_relationship: ConflictRelationship | null;
};

export type AuditTrailResult = {
  active: boolean;
  entries_recorded: number;
  total_entries: number;
  care_recipient_id: string;
  replayable: boolean;
  latest_sequence: number;
  conflict_entries: number;
  rules_upheld: readonly string[];
  defining_principle: string;
};

export type RecordAuditInput = {
  actor: AuditActor;
  action_type: AuditActionType;
  entity_type: string;
  entity_id: string;
  previous_state?: Record<string, unknown> | null;
  new_state?: Record<string, unknown> | null;
  reason: AuditReason;
  reason_detail?: string | null;
  confidence_before?: number | null;
  confidence_after?: number | null;
  related_events?: string[];
  related_audit_id?: string | null;
  conflict_relationship?: ConflictRelationship | null;
  care_recipient_id: string;
  timestamp?: string;
};
