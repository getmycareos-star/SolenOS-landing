-- Audit Trail System — immutable append-only CareContext change log.
-- Run: psql $DATABASE_URL -f db/migrations/046_audit_trail_system.sql

CREATE TABLE IF NOT EXISTS audit_entries (
  audit_id TEXT PRIMARY KEY,
  sequence INTEGER NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  previous_state JSONB,
  new_state JSONB,
  reason TEXT NOT NULL,
  reason_detail TEXT,
  confidence_before REAL,
  confidence_after REAL,
  related_events JSONB NOT NULL DEFAULT '[]',
  related_audit_id TEXT,
  conflict_relationship TEXT,
  care_recipient_id TEXT
);

CREATE INDEX IF NOT EXISTS audit_entries_recipient_seq_idx
  ON audit_entries (care_recipient_id, sequence ASC);

CREATE INDEX IF NOT EXISTS audit_entries_entity_idx
  ON audit_entries (entity_type, entity_id, timestamp DESC);

COMMENT ON TABLE audit_entries IS
  'Immutable audit trail — source of truth; CareContext is materialized view.';
