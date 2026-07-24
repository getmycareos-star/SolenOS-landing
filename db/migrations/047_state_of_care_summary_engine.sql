-- State of Care Summary Engine — derived decision-ready CareContext compression.
-- Run: psql $DATABASE_URL -f db/migrations/047_state_of_care_summary_engine.sql

CREATE TABLE IF NOT EXISTS state_of_care_snapshots (
  care_recipient_id TEXT NOT NULL,
  snapshot_version INTEGER NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  summary JSONB NOT NULL,
  what_matters_most TEXT NOT NULL,
  PRIMARY KEY (care_recipient_id, snapshot_version)
);

CREATE INDEX IF NOT EXISTS state_of_care_recipient_time_idx
  ON state_of_care_snapshots (care_recipient_id, timestamp DESC);

COMMENT ON TABLE state_of_care_snapshots IS
  'Derived StateOfCareSummary snapshots — always recomputed from CareContext, never user-edited.';
