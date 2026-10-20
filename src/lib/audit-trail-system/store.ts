import type { AuditEntry } from "./types";
import { Pool } from 'pg';

// Database connection pool
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

/**
 * Append an audit entry to the persistent store
 * @param entry The audit entry to append (without database-generated fields)
 * @returns The appended audit entry with database-generated fields
 */
export async function appendAuditEntry(entry: Omit<AuditEntry, "audit_id" | "timestamp" | "sequence">): Promise<AuditEntry> {
  // Get the next sequence number
  const sequenceResult = await pool.query(
    "SELECT COALESCE(MAX(sequence), 0) + 1 as next_seq FROM audit_trail WHERE care_recipient_id = $1",
    [entry.care_recipient_id]
  );
  const sequence = sequenceResult.rows[0].next_seq;

  // Insert the audit entry into the database
  const result = await pool.query(
    `
    INSERT INTO audit_trail (
      audit_id, timestamp, sequence, care_recipient_id, actor_type, actor_id,
      action_type, target_entity_type, target_entity_id, previous_state, new_state,
      reason, reason_detail, confidence_before, confidence_after, related_events,
      related_audit_id, conflict_relationship, care_recipient_id_for_rls
    ) VALUES (
      gen_random_uuid(), NOW(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
    ) RETURNING *
    `,
    [
      sequence,
      entry.care_recipient_id,
      entry.actor.type,
      entry.actor.id,
      entry.action_type,
      entry.target.entity_type,
      entry.target.entity_id,
      entry.previous_state ?? null,
      entry.new_state ?? null,
      entry.reason,
      entry.reason_detail ?? null,
      entry.confidence_before ?? null,
      entry.confidence_after ?? null,
      entry.related_events ?? [],
      entry.related_audit_id ?? null,
      entry.conflict_relationship ?? null,
      entry.care_recipient_id // For RLS
    ]
  );

  const dbEntry = result.rows[0];
  
  // Convert database types to match the AuditEntry type
  return {
    audit_id: dbEntry.audit_id.toString(),
    timestamp: dbEntry.timestamp.toISOString(),
    sequence: dbEntry.sequence,
    care_recipient_id: dbEntry.care_recipient_id.toString(),
    actor: {
      type: dbEntry.actor_type as AuditEntry['actor']['type'],
      id: dbEntry.actor_id.toString()
    },
    action_type: dbEntry.action_type as AuditEntry['action_type'],
    target: {
      entity_type: dbEntry.target_entity_type,
      entity_id: dbEntry.target_entity_id.toString()
    },
    previous_state: dbEntry.previous_state,
    new_state: dbEntry.new_state,
    reason: dbEntry.reason as AuditEntry['reason'],
    reason_detail: dbEntry.reason_detail,
    confidence_before: dbEntry.confidence_before ?? null,
    confidence_after: dbEntry.confidence_after ?? null,
    related_events: dbEntry.related_events.map(id => id.toString()),
    related_audit_id: dbEntry.related_audit_id ? dbEntry.related_audit_id.toString() : null,
    conflict_relationship: dbEntry.conflict_relationship as AuditEntry['conflict_relationship'] | null
  };
}

/**
 * Get all audit logs from the persistent store
 * @returns All audit entries
 */
export async function getAuditLog(): Promise<AuditEntry[]> {
  const result = await pool.query(
    "SELECT * FROM audit_trail ORDER BY sequence ASC"
  );
  
  return result.rows.map(row => ({
    audit_id: row.audit_id.toString(),
    timestamp: row.timestamp.toISOString(),
    sequence: row.sequence,
    care_recipient_id: row.care_recipient_id.toString(),
    actor: {
      type: row.actor_type as AuditEntry['actor']['type'],
      id: row.actor_id.toString()
    },
    action_type: row.action_type as AuditEntry['action_type'],
    target: {
      entity_type: row.target_entity_type,
      entity_id: row.target_entity_id.toString()
    },
    previous_state: row.previous_state,
    new_state: row.new_state,
    reason: row.reason as AuditEntry['reason'],
    reason_detail: row.reason_detail,
    confidence_before: row.confidence_before ?? null,
    confidence_after: row.confidence_after ?? null,
    related_events: row.related_events.map(id => id.toString()),
    related_audit_id: row.related_audit_id ? row.related_audit_id.toString() : null,
    conflict_relationship: row.conflict_relationship as AuditEntry['conflict_relationship'] | null
  }));
}

/**
 * Get audit logs for a specific care recipient from the persistent store
 * @param careRecipientId The care recipient ID to filter by
 * @returns Audit entries for the specified care recipient
 */
export async function getAuditLogForRecipient(careRecipientId: string): Promise<AuditEntry[]> {
  const result = await pool.query(
    "SELECT * FROM audit_trail WHERE care_recipient_id = $1 ORDER BY sequence ASC",
    [careRecipientId]
  );
  
  return result.rows.map(row => ({
    audit_id: row.audit_id.toString(),
    timestamp: row.timestamp.toISOString(),
    sequence: row.sequence,
    care_recipient_id: row.care_recipient_id.toString(),
    actor: {
      type: row.actor_type as AuditEntry['actor']['type'],
      id: row.actor_id.toString()
    },
    action_type: row.action_type as AuditEntry['action_type'],
    target: {
      entity_type: row.target_entity_type,
      entity_id: row.target_entity_id.toString()
    },
    previous_state: row.previous_state,
    new_state: row.new_state,
    reason: row.reason as AuditEntry['reason'],
    reason_detail: row.reason_detail,
    confidence_before: row.confidence_before ?? null,
    confidence_after: row.confidence_after ?? null,
    related_events: row.related_events.map(id => id.toString()),
    related_audit_id: row.related_audit_id ? row.related_audit_id.toString() : null,
    conflict_relationship: row.conflict_relationship as AuditEntry['conflict_relationship'] | null
  }));
}

/**
 * Get the next sequence number for a care recipient
 * @param careRecipientId The care recipient ID
 * @returns The next sequence number
 */
export async function nextSequence(careRecipientId: string): Promise<number> {
  const result = await pool.query(
    "SELECT COALESCE(MAX(sequence), 0) + 1 as next_seq FROM audit_trail WHERE care_recipient_id = $1",
    [careRecipientId]
  );
  return result.rows[0].next_seq;
}

/**
 * Reset the audit trail store (for testing purposes only)
 * WARNING: This deletes all audit data!
 */
export async function resetAuditTrailStore(): Promise<void> {
  await pool.query("TRUNCATE TABLE audit_trail RESTART IDENTITY");
}
