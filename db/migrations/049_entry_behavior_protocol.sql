-- Entry Behavior Protocol — greetings as state reconciliation triggers.
-- Run: psql $DATABASE_URL -f db/migrations/049_entry_behavior_protocol.sql

CREATE TABLE IF NOT EXISTS entry_behavior_log (
  entry_id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  input_classification TEXT NOT NULL,
  entry_mode TEXT NOT NULL,
  state_reconciled BOOLEAN NOT NULL DEFAULT false,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS entry_behavior_caregiver_time_idx
  ON entry_behavior_log (caregiver_id, timestamp DESC);

COMMENT ON TABLE entry_behavior_log IS
  'Session re-entry and initialization events — not conversational turns.';
