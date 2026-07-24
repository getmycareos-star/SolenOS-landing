-- SolenOS Activation System — behavior instrumentation (not reasoning quality).
-- Run: psql $DATABASE_URL -f db/migrations/018_activation_system.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS activation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'ENTRY_CREATED',
    'VOICE_ENTRY_CREATED',
    'DOCUMENT_UPLOADED',
    'RESPONSE_GENERATED',
    'RETURN_SESSION',
    'PROMPT_OPENED',
    'PROMPT_DISMISSED',
    'PROMPT_RESPONDED'
  )),
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS activation_events_user_id_idx ON activation_events (user_id);
CREATE INDEX IF NOT EXISTS activation_events_event_type_idx ON activation_events (event_type);
CREATE INDEX IF NOT EXISTS activation_events_created_at_idx ON activation_events (created_at);

CREATE TABLE IF NOT EXISTS activation_user_state (
  user_id TEXT PRIMARY KEY,
  total_entries INT NOT NULL DEFAULT 0,
  first_entry_at TIMESTAMPTZ NULL,
  last_entry_at TIMESTAMPTZ NULL,
  voice_entry_count INT NOT NULL DEFAULT 0,
  document_entry_count INT NOT NULL DEFAULT 0,
  trust_stage TEXT NOT NULL DEFAULT 'early'
    CHECK (trust_stage IN ('early', 'building', 'established')),
  habit_hour INT NULL CHECK (habit_hour IS NULL OR (habit_hour >= 0 AND habit_hour <= 23)),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE activation_events IS
  'Activation instrumentation — entry channels, prompts, returns. Not reasoning quality.';

COMMENT ON TABLE activation_user_state IS
  'Per-user activation state — trust stage, entry counts, habit window hour.';
