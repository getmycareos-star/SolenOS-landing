-- Contradiction Detection Engine — transition events, preserved contradictions.
-- Run: psql $DATABASE_URL -f db/migrations/056_contradiction_detection_engine.sql

CREATE TABLE IF NOT EXISTS care_transition_events (
  transition_id TEXT PRIMARY KEY,
  care_recipient_id TEXT NOT NULL,
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  change_type TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '[]',
  confidence REAL NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE care_transition_events IS
  'Derived transition records — history never overwritten.';
