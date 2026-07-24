-- Baseline Intelligence Engine — person-specific deviation vs baseline.
-- Run: psql $DATABASE_URL -f db/migrations/059_baseline_intelligence_engine.sql

CREATE TABLE IF NOT EXISTS baseline_intelligence_snapshots (
  id TEXT PRIMARY KEY,
  care_recipient_id TEXT NOT NULL,
  caregiver_id TEXT NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  baseline_established BOOLEAN NOT NULL DEFAULT FALSE,
  baseline_facts_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  deviations_json JSONB NOT NULL DEFAULT '[]'::jsonb
);

COMMENT ON TABLE baseline_intelligence_snapshots IS
  'Baseline Intelligence — what is normal for this person, and what is unusual.';
