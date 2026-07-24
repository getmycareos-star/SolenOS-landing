-- Care Timeline Engine — chronological events, deduplicated facts, care record.
-- Run: psql $DATABASE_URL -f db/migrations/050_care_timeline_engine.sql

CREATE TABLE IF NOT EXISTS care_timeline_events (
  timeline_event_id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  source_channel TEXT NOT NULL,
  source_event_id TEXT NOT NULL,
  extracted_entities JSONB NOT NULL DEFAULT '{}',
  confidence REAL NOT NULL,
  abstract_label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS medical_facts (
  fact_id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  fact_type TEXT NOT NULL,
  name TEXT NOT NULL,
  state JSONB NOT NULL,
  provenance JSONB NOT NULL DEFAULT '[]',
  last_updated TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS timeline_conflicts (
  conflict_id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  field TEXT NOT NULL,
  related_events JSONB NOT NULL,
  status TEXT NOT NULL,
  shared_message TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS care_timeline_patient_time_idx
  ON care_timeline_events (patient_id, timestamp ASC);

COMMENT ON TABLE care_timeline_events IS
  'Chronological care timeline — state drivers, not logs.';
