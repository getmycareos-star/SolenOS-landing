-- SolenOS Continuous Care Record — structured events + retrieval indexes.
-- Run: psql $DATABASE_URL -f db/migrations/019_continuous_care_record.sql

-- Expand event types for continuous care record
ALTER TABLE care_events DROP CONSTRAINT IF EXISTS care_events_event_type_check;
ALTER TABLE care_events ADD CONSTRAINT care_events_event_type_check
  CHECK (event_type IN (
    'observation', 'fall', 'medication_change', 'symptom', 'appointment', 'behavior', 'task', 'unknown',
    'specialist_visit', 'hospital_admission', 'hospital_discharge', 'emergency_visit',
    'therapy_session', 'insurance_call', 'family_decision', 'caregiver_note'
  ));

CREATE INDEX IF NOT EXISTS care_events_created_by_idx
  ON care_events (created_by, created_at DESC);

CREATE INDEX IF NOT EXISTS care_events_content_search_idx
  ON care_events USING gin (to_tsvector('english', content));

CREATE INDEX IF NOT EXISTS care_events_metadata_gin_idx
  ON care_events USING gin (metadata);

COMMENT ON COLUMN care_events.metadata IS
  'Structured care event fields live in metadata.structured — people, decisions, actions, symptoms, documents, outcome.';
