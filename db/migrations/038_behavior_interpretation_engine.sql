-- Behavior Interpretation Engine — domain intelligence on CareEvents.
-- Run: psql $DATABASE_URL -f db/migrations/038_behavior_interpretation_engine.sql

CREATE TABLE IF NOT EXISTS behavior_interpretation_snapshots (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  behavior_id TEXT NOT NULL,
  source_event_id TEXT NOT NULL,
  hypotheses JSONB NOT NULL DEFAULT '[]',
  knowledge_node JSONB NOT NULL DEFAULT '{}',
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS behavior_interpretation_caregiver_idx
  ON behavior_interpretation_snapshots (caregiver_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS behavior_longitudinal_patterns (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  behavior_id TEXT NOT NULL,
  pattern JSONB NOT NULL DEFAULT '{}',
  observation_count INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE behavior_interpretation_snapshots IS
  'Behavior knowledge graph nodes — observable signals, not diagnoses.';
