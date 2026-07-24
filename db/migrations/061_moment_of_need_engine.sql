-- Moment-of-Need Engine — real-time understanding during difficult caregiver moments.
-- Run: psql $DATABASE_URL -f db/migrations/061_moment_of_need_engine.sql

CREATE TABLE IF NOT EXISTS moment_of_need_snapshots (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  care_recipient_id TEXT,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  triggered BOOLEAN NOT NULL DEFAULT FALSE,
  change_type TEXT,
  sections_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence TEXT NOT NULL DEFAULT 'low'
);

COMMENT ON TABLE moment_of_need_snapshots IS
  'Moment-of-Need — what changed, what we know, possible context, questions worth tracking.';
