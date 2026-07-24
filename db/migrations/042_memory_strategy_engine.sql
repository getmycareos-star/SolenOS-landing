-- Memory Strategy Engine — hierarchical memory tiers and selective continuity.
-- Run: psql $DATABASE_URL -f db/migrations/042_memory_strategy_engine.sql

CREATE TABLE IF NOT EXISTS memory_strategy_records (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  source_event_id TEXT NOT NULL,
  label TEXT NOT NULL,
  tier TEXT NOT NULL,
  confidence_pct INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  why_remembered TEXT NOT NULL,
  what_would_invalidate TEXT NOT NULL,
  evidence_event_ids JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_confirmed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS memory_strategy_transitions (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  memory_id TEXT NOT NULL,
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  reason TEXT NOT NULL,
  source_event_id TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS memory_strategy_records_caregiver_idx
  ON memory_strategy_records (caregiver_id, tier, status);

CREATE INDEX IF NOT EXISTS memory_strategy_transitions_caregiver_idx
  ON memory_strategy_transitions (caregiver_id, recorded_at DESC);

COMMENT ON TABLE memory_strategy_records IS
  'Classified memory tiers — permanent, long-lived, short-lived, session — with explainable retention.';

COMMENT ON TABLE memory_strategy_transitions IS
  'Promotion, demotion, and conflict transitions — history preserved, never silently overwritten.';
