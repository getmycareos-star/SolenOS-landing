-- Task extraction + current state view engines.
-- Run: psql $DATABASE_URL -f db/migrations/051_task_and_state_view_engines.sql

CREATE TABLE IF NOT EXISTS derived_care_tasks (
  task_id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  description TEXT NOT NULL,
  source_event_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  due_date DATE,
  kind TEXT
);

CREATE TABLE IF NOT EXISTS current_state_snapshots (
  patient_id TEXT NOT NULL,
  snapshot_at TIMESTAMPTZ NOT NULL,
  view JSONB NOT NULL,
  PRIMARY KEY (patient_id, snapshot_at)
);

COMMENT ON TABLE derived_care_tasks IS
  'Tasks derived from timeline events — never manual primary source.';
