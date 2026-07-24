-- SolenOS Caregiver Reality Model — generalized care journey events.
-- Run: psql $DATABASE_URL -f db/migrations/020_care_journey_events.sql
--
-- Medical, legal, financial, family, administrative — the full care journey.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS care_journey_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NULL REFERENCES cases(id) ON DELETE SET NULL,
  caregiver_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'medical', 'legal', 'financial', 'caregiving', 'administrative', 'family', 'other'
  )),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  event_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL DEFAULT 'caregiver',
  attachments JSONB NOT NULL DEFAULT '[]',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS care_journey_events_caregiver_date_idx
  ON care_journey_events (caregiver_id, event_date DESC);

CREATE INDEX IF NOT EXISTS care_journey_events_case_date_idx
  ON care_journey_events (case_id, event_date DESC);

CREATE INDEX IF NOT EXISTS care_journey_events_category_idx
  ON care_journey_events (category, event_date DESC);

CREATE INDEX IF NOT EXISTS care_journey_events_search_idx
  ON care_journey_events USING gin (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
  );

COMMENT ON TABLE care_journey_events IS
  'Care journey events — medical, legal, financial, family, administrative continuity.';

COMMENT ON COLUMN care_journey_events.category IS
  'Journey category: medical, legal, financial, caregiving, administrative, family, other.';
