-- SolenOS Multilingual Execution Layer — user language preferences.
-- Run: psql $DATABASE_URL -f db/migrations/010_multilingual_execution.sql

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS language_preference TEXT NOT NULL DEFAULT 'en'
    CHECK (
      language_preference IN (
        'en','es','zh','tl','vi','ko','fa','ar','ru','hy'
      )
    ),
  ADD COLUMN IF NOT EXISTS ui_language TEXT NOT NULL DEFAULT 'en'
    CHECK (
      ui_language IN (
        'en','es','zh','tl','vi','ko','fa','ar','ru','hy'
      )
    ),
  ADD COLUMN IF NOT EXISTS voice_language TEXT NOT NULL DEFAULT 'en'
    CHECK (
      voice_language IN (
        'en','es','zh','tl','vi','ko','fa','ar','ru','hy'
      )
    );

COMMENT ON COLUMN users.language_preference IS
  'Primary SolenOS execution language — controls LLM output layer only.';

COMMENT ON COLUMN users.ui_language IS
  'UI rendering language — mirrors language_preference by default.';

COMMENT ON COLUMN users.voice_language IS
  'Reserved voice layer language — mirrors language_preference; not active in MVP.';
