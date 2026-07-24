-- SolenOS Dementia Layer V1 — care context extension on living care record.
-- Run: psql $DATABASE_URL -f db/migrations/017_dementia_layer.sql
--
-- Storage and retrieval only. No inference, prediction, or clinical judgment.

ALTER TABLE care_recipient_profiles
  ADD COLUMN IF NOT EXISTS care_context TEXT NOT NULL DEFAULT 'general'
    CHECK (care_context IN ('general', 'dementia', 'future_condition'));

ALTER TABLE care_recipient_profiles
  ADD COLUMN IF NOT EXISTS dementia_context JSONB NULL;

COMMENT ON COLUMN care_recipient_profiles.care_context IS
  'Caregiving context extension: general, dementia, or future_condition.';

COMMENT ON COLUMN care_recipient_profiles.dementia_context IS
  'Structured dementia context when care_context = dementia — stage, wandering, sundowning, medication risk, driving, financial risk observations.';
