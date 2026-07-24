-- Timeline Reconstruction Engine — fragmented input to chronological view.
-- Run: psql $DATABASE_URL -f db/migrations/057_timeline_reconstruction_engine.sql

CREATE TABLE IF NOT EXISTS reconstructed_timeline_nodes (
  node_id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  observation TEXT NOT NULL,
  normalized_timestamp TIMESTAMPTZ NOT NULL,
  temporal_confidence REAL NOT NULL,
  ordering_label TEXT NOT NULL,
  source_event_id TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE reconstructed_timeline_nodes IS
  'Multi-hypothesis timeline reconstruction from caregiver memory fragments.';
