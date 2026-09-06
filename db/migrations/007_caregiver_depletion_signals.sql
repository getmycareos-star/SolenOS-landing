-- Migration 007: Add caregiver depletion signal columns to interactions
-- Depletion signals are observational telemetry labels only — they do NOT
-- route lifecycle, branch UX, change output schema, or trigger behavioral intervention.

ALTER TABLE interactions
  ADD COLUMN IF NOT EXISTS caregiver_depletion_state TEXT,
  ADD COLUMN IF NOT EXISTS is_single_caregiver BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS environmental_dependency_flag TEXT;

-- caregiver_depletion_state: normal | elevated | critical
-- is_single_caregiver: true only when explicitly stated by caregiver
-- environmental_dependency_flag: support_anchor_present | none
