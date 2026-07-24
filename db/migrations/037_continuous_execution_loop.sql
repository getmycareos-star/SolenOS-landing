-- Continuous execution loop — event-sourced runtime engine.
-- Run: psql $DATABASE_URL -f db/migrations/037_continuous_execution_loop.sql

CREATE TABLE IF NOT EXISTS continuous_execution_snapshots (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  system_mode TEXT NOT NULL CHECK (system_mode IN ('empty', 'bootstrap', 'continuous')),
  loop_phase TEXT NOT NULL,
  event_count INTEGER NOT NULL DEFAULT 0,
  uncertainty_count INTEGER NOT NULL DEFAULT 0,
  diff JSONB NOT NULL DEFAULT '{}',
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS continuous_execution_snapshots_caregiver_idx
  ON continuous_execution_snapshots (caregiver_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS uncertainty_records (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  label TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('OPEN', 'ASKED', 'ANSWERED', 'INVALIDATED')),
  event_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS uncertainty_records_caregiver_state_idx
  ON uncertainty_records (caregiver_id, state);

COMMENT ON TABLE continuous_execution_snapshots IS
  'Append-only execution loop snapshots — diff triggers output generation.';
