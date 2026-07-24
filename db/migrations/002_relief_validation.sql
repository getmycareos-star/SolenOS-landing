-- SolenOS relief validation layer — interaction-bound output effectiveness only.
-- Run: psql $DATABASE_URL -f db/migrations/002_relief_validation.sql

ALTER TABLE interactions
  ADD COLUMN IF NOT EXISTS input_category TEXT NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS relief_outcome TEXT NULL
    CHECK (relief_outcome IS NULL OR relief_outcome IN ('high', 'partial', 'none', 'failure')),
  ADD COLUMN IF NOT EXISTS requery_detected BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS helpful_feedback BOOLEAN NULL;

ALTER TABLE feedback
  ADD COLUMN IF NOT EXISTS interaction_id UUID NULL REFERENCES interactions(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS feedback_interaction_id_idx ON feedback(interaction_id);

-- Drift prevention: relief validation measures outputs, not users.
-- trust_score on users is deprecated — do not use for product decisions.

