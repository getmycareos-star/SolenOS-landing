-- Crisis Mode Interaction Layer — triage overlay for high-stress situations.
-- Run: psql $DATABASE_URL -f db/migrations/044_crisis_mode_interaction_layer.sql

CREATE TABLE IF NOT EXISTS crisis_mode_snapshots (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  crisis_mode BOOLEAN NOT NULL DEFAULT FALSE,
  urgency_level TEXT NOT NULL,
  trigger_reasons JSONB NOT NULL DEFAULT '[]',
  crisis_output JSONB,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS crisis_mode_snapshots_caregiver_idx
  ON crisis_mode_snapshots (caregiver_id, captured_at DESC);

COMMENT ON TABLE crisis_mode_snapshots IS
  'Dynamic crisis interaction state — action guidance over exploration when urgency exceeds threshold.';
