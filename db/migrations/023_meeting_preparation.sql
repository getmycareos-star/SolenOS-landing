-- Meeting Preparation Engine — scheduled meetings and preparation packs.
-- Run: psql $DATABASE_URL -f db/migrations/023_meeting_preparation.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS caregiving_meetings (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'medical', 'legal', 'financial', 'care_coordination', 'family', 'other'
  )),
  datetime TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'scheduled', 'completed', 'cancelled', 'proposed_meeting'
  )),
  source TEXT NOT NULL CHECK (source IN ('manual', 'calendar', 'document_inferred')),
  caregiver_id TEXT NOT NULL,
  case_id UUID NULL REFERENCES cases(id) ON DELETE SET NULL,
  linked_events JSONB NOT NULL DEFAULT '[]',
  preparation_generated BOOLEAN NOT NULL DEFAULT FALSE,
  preparation_pack JSONB NULL,
  requires_user_confirmation BOOLEAN NOT NULL DEFAULT FALSE,
  preparation_window_hours INTEGER NOT NULL DEFAULT 48,
  outcome JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS caregiving_meetings_caregiver_datetime_idx
  ON caregiving_meetings (caregiver_id, datetime ASC);

CREATE INDEX IF NOT EXISTS caregiving_meetings_status_idx
  ON caregiving_meetings (status, datetime ASC);

COMMENT ON TABLE caregiving_meetings IS
  'Caregiving meetings — preparation packs generated from Care Journey context only.';
