-- Policy Engine — runtime consent and compliance audit log.
-- Run: psql $DATABASE_URL -f db/migrations/055_policy_engine.sql

CREATE TABLE IF NOT EXISTS consent_profiles (
  user_id TEXT PRIMARY KEY,
  accepted_terms_version TEXT NOT NULL,
  medical_disclaimer_acknowledged BOOLEAN NOT NULL,
  privacy_model_acknowledged BOOLEAN NOT NULL,
  multi_caregiver_acknowledged BOOLEAN NOT NULL,
  data_improvement_consent BOOLEAN NOT NULL DEFAULT false,
  no_advertising_acknowledged BOOLEAN NOT NULL,
  limited_mode BOOLEAN NOT NULL DEFAULT false,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS policy_audit_log (
  audit_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  passed BOOLEAN NOT NULL,
  violations JSONB NOT NULL DEFAULT '[]',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS policy_audit_user_time_idx
  ON policy_audit_log (user_id, timestamp DESC);

COMMENT ON TABLE consent_profiles IS
  'First-class consent object — hard gate before CareEvent creation.';
COMMENT ON TABLE policy_audit_log IS
  'PolicyEngine audit trail for ingestion, output, clarification, and diff validation.';
