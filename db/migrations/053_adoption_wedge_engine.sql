-- Adoption Wedge Engine — zero-onboarding ingestion-first entry contract.
-- Run: psql $DATABASE_URL -f db/migrations/053_adoption_wedge_engine.sql

CREATE TABLE IF NOT EXISTS adoption_wedge_log (
  wedge_id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  ingestion_ready BOOLEAN NOT NULL,
  is_first_value BOOLEAN NOT NULL,
  events_extracted INT NOT NULL DEFAULT 0,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE adoption_wedge_log IS
  'First-interaction contract — structured summary, current state, actionable output.';
