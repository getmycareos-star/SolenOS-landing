-- Core state correction + data integrity on CareEvents.
-- Run: psql $DATABASE_URL -f db/migrations/028_data_integrity.sql

ALTER TABLE care_context_events
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'committed'
    CHECK (status IN ('committed', 'provisional', 'unparsed_raw', 'invalidated', 'superseded')),
  ADD COLUMN IF NOT EXISTS integrity JSONB NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS care_event_audit_trail (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  caregiver_id TEXT NOT NULL,
  action TEXT NOT NULL,
  previous_snapshot JSONB,
  updated_snapshot JSONB,
  reason TEXT,
  user_source TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS care_event_audit_event_idx
  ON care_event_audit_trail (event_id, created_at DESC);

CREATE INDEX IF NOT EXISTS care_context_events_status_idx
  ON care_context_events (caregiver_id, status);

COMMENT ON COLUMN care_context_events.status IS
  'Lifecycle: committed, provisional, unparsed_raw, invalidated (soft delete), superseded.';

COMMENT ON TABLE care_event_audit_trail IS
  'Append-only audit — original extraction, user corrections, timestamps. Never hard delete.';
