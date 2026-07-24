-- MVP surface area — first usable product surface and post-entry continuity behavior.
-- Run: psql $DATABASE_URL -f db/migrations/036_mvp_surface_area.sql

CREATE TABLE IF NOT EXISTS mvp_surface_visits (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  system_state TEXT NOT NULL CHECK (system_state IN ('empty', 'active_continuity')),
  event_count INTEGER NOT NULL DEFAULT 0,
  unresolved_questions JSONB NOT NULL DEFAULT '[]',
  visited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mvp_surface_visits_caregiver_idx
  ON mvp_surface_visits (caregiver_id, visited_at DESC);

COMMENT ON TABLE mvp_surface_visits IS
  'MVP surface area — return-session continuity and post-entry behavior tracking.';
