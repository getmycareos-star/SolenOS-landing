-- CareContextRoot + canonical CareEvent fields (event-sourced continuity).
-- Run: psql $DATABASE_URL -f db/migrations/025_situation_entry.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS care_context_roots (
  id TEXT PRIMARY KEY DEFAULT 'CareContextRoot',
  caregiver_id TEXT NOT NULL UNIQUE,
  root_event_id TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS care_context_events (
  id TEXT PRIMARY KEY,
  context_id TEXT NOT NULL DEFAULT 'CareContextRoot',
  caregiver_id TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  raw_input TEXT NOT NULL,
  extracted_type TEXT NOT NULL,
  entities JSONB NOT NULL DEFAULT '[]',
  attributes JSONB NOT NULL DEFAULT '{}',
  uncertainty JSONB NOT NULL DEFAULT '[]',
  source TEXT NOT NULL CHECK (source IN ('user_input', 'document')),
  root_event_id TEXT NULL,
  document_id TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS care_context_events_caregiver_idx
  ON care_context_events (caregiver_id, timestamp DESC);

COMMENT ON TABLE care_context_roots IS
  'Single CareContextRoot per caregiver — secondary container; CareEvent is primary truth.';

COMMENT ON TABLE care_context_events IS
  'Canonical CareEvents attached to CareContextRoot — event-sourced continuity.';
