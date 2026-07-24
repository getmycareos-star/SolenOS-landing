-- Network effect & data moat — compounding continuity assets.
-- Run: psql $DATABASE_URL -f db/migrations/033_network_effect_moat.sql

CREATE TABLE IF NOT EXISTS care_moat_store (
  caregiver_id TEXT PRIMARY KEY,
  cumulative_corrections INT NOT NULL DEFAULT 0,
  first_event_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS care_resolved_uncertainties (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  question TEXT NOT NULL,
  resolution TEXT NOT NULL,
  resolved_by_event_id TEXT,
  resolved_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS care_enrichment_actions (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  description TEXT NOT NULL,
  target_event_id TEXT,
  source_event_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS care_interaction_outcomes (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  outcome_type TEXT NOT NULL,
  description TEXT NOT NULL,
  event_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS care_resolved_uncertainties_caregiver_idx
  ON care_resolved_uncertainties (caregiver_id, resolved_at DESC);

CREATE INDEX IF NOT EXISTS care_enrichment_actions_caregiver_idx
  ON care_enrichment_actions (caregiver_id, created_at DESC);

CREATE INDEX IF NOT EXISTS care_interaction_outcomes_caregiver_idx
  ON care_interaction_outcomes (caregiver_id, created_at DESC);

COMMENT ON TABLE care_moat_store IS
  'Per-caregiver compounding continuity state — corrections, first event, moat metrics.';

COMMENT ON TABLE care_resolved_uncertainties IS
  'Questions that became permanent structured knowledge over time.';

COMMENT ON TABLE care_enrichment_actions IS
  'Continuous enrichment — link, resolve, strengthen, update timeline.';

COMMENT ON TABLE care_interaction_outcomes IS
  'Every interaction must grow Care Context — tracked outcomes per ingest.';
