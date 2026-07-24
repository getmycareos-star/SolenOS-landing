-- SolenOS Capacity & Self Modules — caregiver profile, capacity, resolved record.
-- Run: psql $DATABASE_URL -f db/migrations/016_capacity_self_modules.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS caregiver_self_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id TEXT NOT NULL UNIQUE,
  profile JSONB NOT NULL DEFAULT '{}',
  session_capacity TEXT NULL CHECK (session_capacity IN ('low', 'medium', 'high')),
  resolved_items JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE caregiver_self_profiles IS
  'Caregiver own profile — same structure as care recipient; same engine, same seriousness.';

COMMENT ON COLUMN caregiver_self_profiles.session_capacity IS
  'Optional session capacity: low | medium | high — one tap at session start or check-in.';

COMMENT ON COLUMN caregiver_self_profiles.resolved_items IS
  'Factual record of resolved items for weekly reflection — plain evidence, not sentiment.';
