-- Post-care insight signal — observational label on interactions ONLY (not a product mode).
-- Run: psql $DATABASE_URL -f db/migrations/006_care_context_state.sql

ALTER TABLE interactions
  ADD COLUMN IF NOT EXISTS care_context_state TEXT NOT NULL DEFAULT 'uncertain'
  CHECK (care_context_state IN ('active_care', 'crisis', 'post_care', 'uncertain'));

COMMENT ON COLUMN interactions.care_context_state IS
  'Shallow surface-signal label for telemetry observation — NOT profiling, segmentation, or lifecycle routing.';

-- Drift prevention: care_context_state is telemetry observation — not profiling or lifecycle routing.
