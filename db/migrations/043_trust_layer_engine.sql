-- Trust Layer Engine — epistemic safety contract for explainable outputs.
-- Run: psql $DATABASE_URL -f db/migrations/043_trust_layer_engine.sql

CREATE TABLE IF NOT EXISTS trust_layer_snapshots (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  known JSONB NOT NULL DEFAULT '[]',
  assumed JSONB NOT NULL DEFAULT '[]',
  unknown JSONB NOT NULL DEFAULT '[]',
  freshness_score REAL NOT NULL DEFAULT 0,
  confidence REAL NOT NULL DEFAULT 0,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS trust_layer_snapshots_caregiver_idx
  ON trust_layer_snapshots (caregiver_id, captured_at DESC);

COMMENT ON TABLE trust_layer_snapshots IS
  'Structured trust block — known, assumed, unknown, recency, confidence on every output.';
