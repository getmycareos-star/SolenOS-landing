-- SolenOS Cognitive Relief Modules — persistent care recipient profile + shared views.
-- Run: psql $DATABASE_URL -f db/migrations/015_cognitive_relief_foundation.sql
--
-- Foundational store for tell-once, pattern recognition, location index,
-- close-the-loop check-ins, asymmetric sharing, and runway view.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- care_recipient_profiles — accumulates across sessions per caregiver/case
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS care_recipient_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NULL REFERENCES cases(id) ON DELETE SET NULL,
  caregiver_id TEXT NOT NULL,
  profile JSONB NOT NULL DEFAULT '{}',
  last_checkin_at TIMESTAMPTZ NULL,
  checkin_period TEXT NULL CHECK (checkin_period IN ('daily', 'weekly')),
  optional_budget NUMERIC NULL CHECK (optional_budget IS NULL OR optional_budget >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS care_recipient_profiles_caregiver_idx
  ON care_recipient_profiles (caregiver_id);

COMMENT ON TABLE care_recipient_profiles IS
  'Living care record per recipient — auto-synthesized from entries; caregiver corrects, never re-authors from scratch.';

COMMENT ON COLUMN care_recipient_profiles.profile IS
  'Structured profile: basics, conditions, medications, key_dates, care_team, tagged_event_log, location_index.';

-- ---------------------------------------------------------------------------
-- shared_view_tokens — narrow, time-boxed, read-only asymmetric sharing
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS shared_view_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  profile_id UUID NOT NULL REFERENCES care_recipient_profiles(id) ON DELETE CASCADE,
  recipient_label TEXT NOT NULL,
  scope JSONB NOT NULL DEFAULT '{}',
  included_fields JSONB NOT NULL DEFAULT '[]',
  payload JSONB NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS shared_view_tokens_token_idx ON shared_view_tokens (token);
CREATE INDEX IF NOT EXISTS shared_view_tokens_expires_idx ON shared_view_tokens (expires_at);

COMMENT ON TABLE shared_view_tokens IS
  'Token-based read-only shared views — no recipient account required; expires automatically.';
