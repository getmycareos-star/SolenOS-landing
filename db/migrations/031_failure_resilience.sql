-- Failure modes & resilience — preserve raw input, classify failures, retry queue.
-- Run: psql $DATABASE_URL -f db/migrations/031_failure_resilience.sql

CREATE TABLE IF NOT EXISTS care_failure_records (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (
    category IN (
      'extraction_failure',
      'incomplete_context',
      'ambiguous_interpretation',
      'graph_linking_failure',
      'conflicting_information',
      'processing_failure'
    )
  ),
  outcome TEXT NOT NULL CHECK (outcome IN ('clarify', 'preserve_raw', 'defer')),
  message TEXT NOT NULL,
  raw_input_id TEXT,
  event_id TEXT,
  extracted_partial JSONB NOT NULL DEFAULT '[]',
  not_understood JSONB NOT NULL DEFAULT '[]',
  clarification_questions JSONB NOT NULL DEFAULT '[]',
  possible_interpretations JSONB NOT NULL DEFAULT '[]',
  relationship_status TEXT,
  conflict_id TEXT,
  recoverable BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS care_pending_processing (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  raw_input_id TEXT NOT NULL,
  content_preview TEXT NOT NULL,
  failure_category TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('complete', 'partial', 'pending', 'deferred', 'failed_recoverable')
  ),
  retry_count INT NOT NULL DEFAULT 0,
  max_retries INT NOT NULL DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  error_message TEXT,
  preserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS care_extraction_confidence (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  object_id TEXT NOT NULL,
  object_type TEXT NOT NULL CHECK (object_type IN ('event', 'candidate', 'raw_input')),
  confidence_score NUMERIC(4, 3) NOT NULL,
  confidence_level TEXT NOT NULL CHECK (confidence_level IN ('low', 'medium', 'high')),
  uncertainty_reason TEXT NOT NULL,
  known_facts JSONB NOT NULL DEFAULT '[]',
  unknown_facts JSONB NOT NULL DEFAULT '[]',
  missing_information JSONB NOT NULL DEFAULT '[]',
  verification_status TEXT NOT NULL CHECK (
    verification_status IN ('unverified', 'needs_confirmation', 'user_confirmed', 'rejected')
  ),
  needs_confirmation_before_linking BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS care_failure_records_caregiver_idx
  ON care_failure_records (caregiver_id, created_at DESC);

CREATE INDEX IF NOT EXISTS care_pending_processing_caregiver_idx
  ON care_pending_processing (caregiver_id, next_retry_at);

CREATE INDEX IF NOT EXISTS care_extraction_confidence_object_idx
  ON care_extraction_confidence (caregiver_id, object_id);

COMMENT ON TABLE care_failure_records IS
  'Classified failure modes — never hide uncertainty; always clarify, preserve raw, or defer.';

COMMENT ON TABLE care_pending_processing IS
  'Recoverable processing failures — auto-retry without re-entering user input.';

COMMENT ON TABLE care_extraction_confidence IS
  'Per-object confidence envelope — score, uncertainty reason, missing info, verification status.';
