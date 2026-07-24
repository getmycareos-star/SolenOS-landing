-- Care Reality Profile Engine — person-specific Living Care Record.
-- Run: psql $DATABASE_URL -f db/migrations/060_care_reality_profile_engine.sql

CREATE TABLE IF NOT EXISTS care_reality_profile_snapshots (
  id TEXT PRIMARY KEY,
  care_recipient_id TEXT NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sections_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  relationship_insights_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  person_specific_summary TEXT NOT NULL DEFAULT ''
);

COMMENT ON TABLE care_reality_profile_snapshots IS
  'Care Reality Profile — evolving person-specific understanding, not generic categories.';
