-- Trust & provenance — observable trust, permanent provenance, audit trail.
-- Run: psql $DATABASE_URL -f db/migrations/032_trust_provenance.sql

CREATE TABLE IF NOT EXISTS care_provenance_records (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  fact_id TEXT NOT NULL,
  fact_label TEXT NOT NULL,
  source_label TEXT NOT NULL,
  source_type TEXT NOT NULL,
  extracted_from TEXT,
  captured_at TIMESTAMPTZ NOT NULL,
  confidence TEXT NOT NULL CHECK (confidence IN ('low', 'medium', 'high')),
  verification_status TEXT NOT NULL CHECK (
    verification_status IN ('unverified', 'needs_confirmation', 'user_confirmed', 'rejected')
  ),
  truth_sources JSONB NOT NULL DEFAULT '[]',
  raw_input_id TEXT,
  event_id TEXT,
  document_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS care_trust_audit (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  field_label TEXT NOT NULL,
  original_value TEXT,
  updated_value TEXT,
  changed_by TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS care_generation_attribution (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  question TEXT,
  response_preview TEXT,
  confidence_level TEXT NOT NULL CHECK (
    confidence_level IN ('high', 'medium', 'low', 'insufficient')
  ),
  evidence_event_ids JSONB NOT NULL DEFAULT '[]',
  retrieval_pipeline JSONB NOT NULL DEFAULT '[]',
  generation_boundaries JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS care_provenance_records_caregiver_idx
  ON care_provenance_records (caregiver_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS care_provenance_records_event_idx
  ON care_provenance_records (event_id);

CREATE INDEX IF NOT EXISTS care_trust_audit_event_idx
  ON care_trust_audit (event_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS care_trust_audit_caregiver_idx
  ON care_trust_audit (caregiver_id, changed_at DESC);

COMMENT ON TABLE care_provenance_records IS
  'Permanent provenance per extracted fact — source, confidence, verification status.';

COMMENT ON TABLE care_trust_audit IS
  'Human-readable audit trail — original/updated values, who, when, why.';

COMMENT ON TABLE care_generation_attribution IS
  'Retrieval-only generation attribution — evidence IDs and pipeline steps used.';
