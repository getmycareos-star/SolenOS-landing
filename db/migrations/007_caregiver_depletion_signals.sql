-- Caregiver depletion signals — observational labels on interactions ONLY (not a product mode).
-- Run: psql $DATABASE_URL -f db/migrations/007_caregiver_depletion_signals.sql

ALTER TABLE interactions
  ADD COLUMN IF NOT EXISTS caregiver_depletion_state TEXT NOT NULL DEFAULT 'normal'
  CHECK (caregiver_depletion_state IN ('normal', 'elevated', 'critical'));

ALTER TABLE interactions
  ADD COLUMN IF NOT EXISTS is_single_caregiver BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE interactions
  ADD COLUMN IF NOT EXISTS environmental_dependency_flag TEXT NOT NULL DEFAULT 'none'
  CHECK (environmental_dependency_flag IN ('none', 'support_anchor_present'));

COMMENT ON COLUMN interactions.caregiver_depletion_state IS
  'Shallow surface-signal label for telemetry observation — NOT profiling, intervention, or lifecycle routing.';

COMMENT ON COLUMN interactions.is_single_caregiver IS
  'True only when input explicitly states sole caregiving — observational label only.';

COMMENT ON COLUMN interactions.environmental_dependency_flag IS
  'Environmental stability cue attachment — observational label only, not behavioral routing.';

-- Drift prevention: depletion signals are telemetry observation — not profiling or intervention.
