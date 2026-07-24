-- SolenOS telemetry schema — measurement + validation ONLY (not a product surface).
-- Run manually: psql $DATABASE_URL -f db/migrations/001_telemetry_schema.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_sessions INTEGER NOT NULL DEFAULT 0 CHECK (total_sessions >= 0),
  trust_score DOUBLE PRECISION NULL CHECK (trust_score IS NULL OR (trust_score >= 0 AND trust_score <= 1))
);

CREATE TABLE IF NOT EXISTS interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  input_raw TEXT NOT NULL,
  output_structured JSONB NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  relief_signal BOOLEAN NULL,
  latency_ms INTEGER NOT NULL CHECK (latency_ms >= 0),
  structure_valid BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS interactions_user_id_idx ON interactions(user_id);
CREATE INDEX IF NOT EXISTS interactions_created_at_idx ON interactions(created_at);

CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  helpful_yes_no BOOLEAN NOT NULL,
  reduced_confusion_yes_no BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS feedback_user_id_idx ON feedback(user_id);

-- Drift prevention: forbid expansion columns on users (enforced in application layer + verify script).
