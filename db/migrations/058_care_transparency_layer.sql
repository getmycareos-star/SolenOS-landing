-- Care Transparency Layer — reasoning visibility on every output.
-- Run: psql $DATABASE_URL -f db/migrations/058_care_transparency_layer.sql

CREATE TABLE IF NOT EXISTS care_transparency_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  overall_confidence_pct INT NOT NULL,
  decay_status TEXT NOT NULL,
  panel JSONB NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE care_transparency_snapshots IS
  'Care Transparency Panel audit — data used, ignored, observed vs inferred.';
