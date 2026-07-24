-- SolenOS Voice Observation Capture + TTS preferences.
-- Run: psql $DATABASE_URL -f db/migrations/013_voice_observation_tts.sql
--
-- language_preference already exists from 010 with the exact 10-language CHECK.
-- This migration activates voice I/O columns + SCHEMA for observation tables
-- (runtime store remains IN-MEMORY until Postgres adapter is wired).

-- Refresh comments: language_preference now drives Gemini + TTS output language.
COMMENT ON COLUMN users.language_preference IS
  'Primary SolenOS language — controls Gemini output and ALL TTS voice output (user.language_preference). Exact set: en,es,zh,tl,vi,ko,fa,ar,ru,hy.';

COMMENT ON COLUMN users.voice_language IS
  'Mirrors language_preference for TTS routing (Polly vs Google Cloud TTS).';

-- Female / Male TTS voice preference (where engine allows).
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS tts_voice_profile TEXT NOT NULL DEFAULT 'female'
    CHECK (tts_voice_profile IN ('female', 'male'));

COMMENT ON COLUMN users.tts_voice_profile IS
  'TTS voice profile preference: female | male. Routed to Polly/Google neural variants where available.';

-- Observation capture tables (SCHEMA — wire ObservationPersistenceAdapter to use).
CREATE TABLE IF NOT EXISTS observations (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  transcript TEXT NOT NULL,
  raw_text TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'text'
    CHECK (source_type IN ('voice', 'text')),
  source TEXT NOT NULL DEFAULT 'text'
    CHECK (source IN ('voice', 'text')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS observations_caregiver_created_idx
  ON observations (caregiver_id, created_at DESC);

CREATE TABLE IF NOT EXISTS structured_observations (
  id TEXT PRIMARY KEY,
  observation_id TEXT NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  severity TEXT NOT NULL
    CHECK (severity IN ('low', 'medium', 'high')),
  extracted_signal TEXT NOT NULL,
  signal TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS structured_observations_observation_idx
  ON structured_observations (observation_id);

CREATE INDEX IF NOT EXISTS structured_observations_category_idx
  ON structured_observations (category, created_at DESC);

COMMENT ON TABLE observations IS
  'Caregiver observation capture (voice|text). Runtime MVP may use in-memory store; this is the durable schema.';

COMMENT ON TABLE structured_observations IS
  'Ontology signals extracted from an observation. Multi-signal per observation allowed. Never diagnoses.';

COMMENT ON COLUMN observations.transcript IS
  'Canonical transcript / raw observation text alias.';

COMMENT ON COLUMN observations.source_type IS
  'voice | text — identical observation record shape either way.';

COMMENT ON COLUMN structured_observations.extracted_signal IS
  'Ontology signal name (alias of signal column).';
