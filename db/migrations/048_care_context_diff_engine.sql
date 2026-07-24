-- Care Context Diff Engine — interpreted change since last comprehension point.
-- Run: psql $DATABASE_URL -f db/migrations/048_care_context_diff_engine.sql

CREATE TABLE IF NOT EXISTS care_context_diff_snapshots (
  diff_id TEXT PRIMARY KEY,
  care_recipient_id TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  time_frame TEXT NOT NULL,
  relative_to TIMESTAMPTZ NOT NULL,
  primary_change TEXT NOT NULL,
  sections JSONB NOT NULL,
  has_meaningful_change BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS care_context_diff_recipient_time_idx
  ON care_context_diff_snapshots (care_recipient_id, timestamp DESC);

COMMENT ON TABLE care_context_diff_snapshots IS
  'Derived CareContextDiff — interpreted change translation, not raw event log.';
