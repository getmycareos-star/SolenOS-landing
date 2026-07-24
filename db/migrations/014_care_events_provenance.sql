-- SolenOS CareEvent + event provenance layer.
-- Run: psql $DATABASE_URL -f db/migrations/014_care_events_provenance.sql
--
-- Voice, text, documents, and future inputs all land in care_events.
-- event_sources preserves "why do we believe this?" provenance.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- CareEvent — permanent knowledge object (not input-method-specific)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS care_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  care_record_id UUID NULL REFERENCES cases(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL DEFAULT 'observation'
    CHECK (event_type IN (
      'observation',
      'fall',
      'medication_change',
      'symptom',
      'appointment',
      'behavior',
      'task',
      'unknown'
    )),
  content TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_type TEXT NOT NULL DEFAULT 'text'
    CHECK (source_type IN ('voice', 'text', 'document', 'photo', 'message')),
  confidence DOUBLE PRECISION NULL
    CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  uncertainty_level TEXT NULL
    CHECK (uncertainty_level IS NULL OR uncertainty_level IN ('low', 'medium', 'high')),
  created_by TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS care_events_care_record_created_idx
  ON care_events (care_record_id, created_at DESC);

CREATE INDEX IF NOT EXISTS care_events_source_type_idx
  ON care_events (source_type, created_at DESC);

CREATE INDEX IF NOT EXISTS care_events_event_type_idx
  ON care_events (event_type, created_at DESC);

COMMENT ON TABLE care_events IS
  'Unified caregiver knowledge events — voice, text, document, and future inputs share this shape.';

COMMENT ON COLUMN care_events.care_record_id IS
  'Optional case / care record scope. Nullable until case assignment exists.';

COMMENT ON COLUMN care_events.source_type IS
  'Ingestion method only — intelligence layer treats all sources as observations of care reality.';

COMMENT ON COLUMN care_events.metadata IS
  'Extensible event metadata. Input provenance details also live in event_sources.';

-- ---------------------------------------------------------------------------
-- event_sources — provenance layer ("why do we believe this?")
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS event_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  care_event_id UUID NOT NULL REFERENCES care_events(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL
    CHECK (source_type IN ('voice', 'text', 'document', 'photo', 'message')),
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recognition_confidence DOUBLE PRECISION NULL
    CHECK (recognition_confidence IS NULL OR (recognition_confidence >= 0 AND recognition_confidence <= 1)),
  transcript_uncertain BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS event_sources_care_event_idx
  ON event_sources (care_event_id);

CREATE INDEX IF NOT EXISTS event_sources_source_type_idx
  ON event_sources (source_type, captured_at DESC);

COMMENT ON TABLE event_sources IS
  'Provenance for CareEvents — preserves capture method, confidence, and source metadata for trust.';

COMMENT ON COLUMN event_sources.transcript_uncertain IS
  'True when voice confidence is low or final transcript did not complete cleanly.';
