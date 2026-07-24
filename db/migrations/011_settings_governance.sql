-- SolenOS Settings + System Governance Layer — runtime control plane persistence.
-- Run: psql $DATABASE_URL -f db/migrations/011_settings_governance.sql

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS governance_settings JSONB;

COMMENT ON COLUMN users.governance_settings IS
  'Runtime governance control plane settings — applied post-reasoning only; not user profiling.';
