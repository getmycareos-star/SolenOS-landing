-- Data Acquisition + Failure Resilience Engine (DARE)
-- Run: psql $DATABASE_URL -f db/migrations/026_dare.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS dare_raw_inputs (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  input_type TEXT NOT NULL,
  content TEXT NOT NULL,
  ocr_confidence NUMERIC NULL,
  document_id TEXT NULL,
  document_name TEXT NULL,
  captured_at TIMESTAMPTZ NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dare_extraction_candidates (
  id TEXT PRIMARY KEY,
  raw_input_id TEXT NOT NULL REFERENCES dare_raw_inputs(id) ON DELETE CASCADE,
  extracted_fact TEXT NOT NULL,
  event_signal TEXT NOT NULL,
  confidence NUMERIC NOT NULL,
  confidence_sources JSONB NOT NULL DEFAULT '[]',
  source_span TEXT NOT NULL,
  extraction_method TEXT NOT NULL,
  ambiguity_flags JSONB NOT NULL DEFAULT '[]',
  completeness TEXT NOT NULL,
  missing_fields JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dare_validated_events (
  id TEXT PRIMARY KEY,
  raw_input_id TEXT NOT NULL,
  candidate_id TEXT NOT NULL,
  caregiver_id TEXT NOT NULL,
  extracted_fact TEXT NOT NULL,
  event_signal TEXT NOT NULL,
  confidence_score NUMERIC NOT NULL,
  confidence_sources JSONB NOT NULL DEFAULT '[]',
  validation_method TEXT NOT NULL,
  entities JSONB NOT NULL DEFAULT '[]',
  attributes JSONB NOT NULL DEFAULT '{}',
  document_id TEXT NULL,
  validated_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dare_correction_events (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  target_event_id TEXT NULL,
  target_candidate_id TEXT NULL,
  correction_type TEXT NOT NULL CHECK (correction_type IN ('modify', 'delete', 'merge', 'clarify')),
  corrected_fields JSONB NOT NULL DEFAULT '{}',
  user_source TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dare_conflicting_event_sets (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  event_signal TEXT NOT NULL,
  claims JSONB NOT NULL DEFAULT '[]',
  unresolved BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dare_raw_inputs_caregiver_idx ON dare_raw_inputs (caregiver_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS dare_validated_events_caregiver_idx ON dare_validated_events (caregiver_id, validated_at DESC);

COMMENT ON TABLE dare_raw_inputs IS 'Raw captured input — never processed directly into graph.';
COMMENT ON TABLE dare_validated_events IS 'Resolved truth layer — only validated events enter CareContext graph.';
