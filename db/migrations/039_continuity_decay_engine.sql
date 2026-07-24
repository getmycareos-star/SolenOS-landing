-- Continuity Decay Engine — CareContext freshness and confidence over time.

-- Run: psql $DATABASE_URL -f db/migrations/039_continuity_decay_engine.sql



CREATE TABLE IF NOT EXISTS continuity_decay_snapshots (

  id TEXT PRIMARY KEY,

  caregiver_id TEXT NOT NULL,

  continuity_confidence_pct INTEGER NOT NULL,

  object_confidence JSONB NOT NULL DEFAULT '[]',

  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

);



CREATE INDEX IF NOT EXISTS continuity_decay_caregiver_idx

  ON continuity_decay_snapshots (caregiver_id, captured_at DESC);



CREATE TABLE IF NOT EXISTS continuity_decay_profiles (

  caregiver_id TEXT PRIMARY KEY,

  typical_cadence_days NUMERIC NOT NULL DEFAULT 7,

  update_timestamps JSONB NOT NULL DEFAULT '[]',

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

);



COMMENT ON TABLE continuity_decay_snapshots IS

  'Time-based CareContext confidence — measures understanding freshness, not patient health.';


