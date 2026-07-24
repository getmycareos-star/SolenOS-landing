-- Architectural Boundaries + Clarification Engine — trust invariants and uncertainty reduction.
-- Run: psql $DATABASE_URL -f db/migrations/041_architectural_boundaries_clarification.sql

CREATE TABLE IF NOT EXISTS architectural_boundary_audits (
  id TEXT PRIMARY KEY,
  violations_count INTEGER NOT NULL DEFAULT 0,
  rules_satisfied INTEGER NOT NULL DEFAULT 0,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clarification_engine_snapshots (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  uncertainty_level TEXT NOT NULL,
  confidence_before_pct INTEGER NOT NULL,
  confidence_after_estimated_pct INTEGER NOT NULL,
  questions JSONB NOT NULL DEFAULT '[]',
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS clarification_engine_caregiver_idx
  ON clarification_engine_snapshots (caregiver_id, captured_at DESC);

COMMENT ON TABLE architectural_boundary_audits IS
  'Non-negotiable boundary enforcement — trust over apparent intelligence.';

COMMENT ON TABLE clarification_engine_snapshots IS
  'Minimum-question clarification to reduce uncertainty before reasoning.';
