-- Graph scale & memory layers — episodes, continuity links, long-term summaries.
-- Run: psql $DATABASE_URL -f db/migrations/030_memory_layers.sql

CREATE TABLE IF NOT EXISTS care_memory_episodes (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'monitoring')),
  event_ids JSONB NOT NULL DEFAULT '[]',
  source_event_ids JSONB NOT NULL DEFAULT '[]',
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  summary TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS care_continuity_links (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  from_event_id TEXT NOT NULL,
  to_event_id TEXT NOT NULL,
  link_type TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS care_long_term_summaries (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  narrative TEXT NOT NULL,
  episode_ids JSONB NOT NULL DEFAULT '[]',
  event_ids JSONB NOT NULL DEFAULT '[]',
  derived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reversible BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS care_memory_episodes_caregiver_idx
  ON care_memory_episodes (caregiver_id, started_at DESC);

CREATE INDEX IF NOT EXISTS care_continuity_links_caregiver_idx
  ON care_continuity_links (caregiver_id, created_at DESC);

CREATE INDEX IF NOT EXISTS care_long_term_summaries_caregiver_idx
  ON care_long_term_summaries (caregiver_id, derived_at DESC);

COMMENT ON TABLE care_memory_episodes IS
  'Layer 3 — episode grouping. Links back to raw events; never replaces Layer 1.';

COMMENT ON TABLE care_long_term_summaries IS
  'Layer 4 — derived continuity summaries. Reversible to underlying events.';
