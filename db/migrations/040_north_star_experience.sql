-- North Star Experience — product philosophy layer snapshots.
-- Run: psql $DATABASE_URL -f db/migrations/040_north_star_experience.sql

CREATE TABLE IF NOT EXISTS north_star_experience_snapshots (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  experience_score INTEGER NOT NULL,
  experience_test_passed BOOLEAN NOT NULL DEFAULT false,
  continuity_voice_enabled BOOLEAN NOT NULL DEFAULT false,
  principles_upheld JSONB NOT NULL DEFAULT '[]',
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS north_star_experience_caregiver_idx
  ON north_star_experience_snapshots (caregiver_id, captured_at DESC);

COMMENT ON TABLE north_star_experience_snapshots IS
  'Behavioral evidence for north star experience — continuity felt, not conversation length.';
