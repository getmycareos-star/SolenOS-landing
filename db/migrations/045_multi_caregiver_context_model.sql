-- Multi-Caregiver Context Model — attribution, conflicts, shared care recipient scope.
-- Run: psql $DATABASE_URL -f db/migrations/045_multi_caregiver_context_model.sql

CREATE TABLE IF NOT EXISTS care_recipients (
  care_recipient_id TEXT PRIMARY KEY,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS caregivers (
  caregiver_id TEXT PRIMARY KEY,
  care_recipient_id TEXT NOT NULL REFERENCES care_recipients (care_recipient_id),
  name TEXT,
  relationship_to_care_recipient TEXT,
  role TEXT NOT NULL DEFAULT 'family',
  contact_info TEXT,
  reliability_score REAL NOT NULL DEFAULT 0.5,
  observation_count INTEGER NOT NULL DEFAULT 0,
  last_contribution_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS care_event_attribution (
  event_id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL REFERENCES caregivers (caregiver_id),
  care_recipient_id TEXT NOT NULL REFERENCES care_recipients (care_recipient_id),
  source_type TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS multi_caregiver_conflicts (
  conflict_id TEXT PRIMARY KEY,
  care_recipient_id TEXT NOT NULL REFERENCES care_recipients (care_recipient_id),
  event_ids JSONB NOT NULL DEFAULT '[]',
  conflicting_sources JSONB NOT NULL DEFAULT '[]',
  contradiction_type TEXT NOT NULL,
  resolution_status TEXT NOT NULL DEFAULT 'open',
  description TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS caregivers_recipient_idx ON caregivers (care_recipient_id);
CREATE INDEX IF NOT EXISTS attribution_recipient_idx ON care_event_attribution (care_recipient_id);
CREATE INDEX IF NOT EXISTS conflicts_recipient_idx ON multi_caregiver_conflicts (care_recipient_id, recorded_at DESC);

COMMENT ON TABLE care_event_attribution IS
  'Mandatory multi-source attribution — who observed what, when, under what context.';
