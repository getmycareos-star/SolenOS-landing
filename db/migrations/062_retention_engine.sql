-- Retention Engine — Return Value Loop session snapshots.
-- Run: psql $DATABASE_URL -f db/migrations/062_retention_engine.sql

CREATE TABLE IF NOT EXISTS retention_session_snapshots (
  caregiver_id TEXT PRIMARY KEY,
  care_recipient_id TEXT NOT NULL,
  last_visit_at TIMESTAMPTZ NOT NULL,
  event_count INTEGER NOT NULL DEFAULT 0,
  context_updated_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE retention_session_snapshots IS
  'Retention Engine — last visit tracking for Return State of Care delta computation.';
