-- Dual time model: event_time (editable) + ingestion_time (immutable).
-- Run: psql $DATABASE_URL -f db/migrations/027_time_model.sql

ALTER TABLE care_context_events
  ADD COLUMN IF NOT EXISTS event_time JSONB NOT NULL DEFAULT '{"type":"unknown","confidence":0}',
  ADD COLUMN IF NOT EXISTS ingestion_time TIMESTAMPTZ;

UPDATE care_context_events
SET ingestion_time = COALESCE(ingestion_time, timestamp)
WHERE ingestion_time IS NULL;

ALTER TABLE care_context_events
  ALTER COLUMN ingestion_time SET NOT NULL,
  ALTER COLUMN ingestion_time SET DEFAULT NOW();

CREATE INDEX IF NOT EXISTS care_context_events_ingestion_idx
  ON care_context_events (caregiver_id, ingestion_time DESC);

CREATE TABLE IF NOT EXISTS care_event_time_corrections (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  original_event_id TEXT NOT NULL,
  previous_event_time JSONB NOT NULL,
  updated_event_time JSONB NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('user_correction', 'retrospective_update', 'late_arrival')),
  corrected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS care_event_time_corrections_event_idx
  ON care_event_time_corrections (original_event_id, corrected_at DESC);

COMMENT ON COLUMN care_context_events.event_time IS
  'When the situation occurred in reality — exact, approximate, range, or unknown.';

COMMENT ON COLUMN care_context_events.ingestion_time IS
  'Immutable system anchor — when input was received. Never overwritten by retrospective updates.';

COMMENT ON TABLE care_event_time_corrections IS
  'Append-only re-timing log — event_time changes never silent overwrite.';
