-- SolenOS System Architecture Foundation — case-scoped continuity + append-only events.
-- Run: psql $DATABASE_URL -f db/migrations/009_system_architecture_foundation.sql
--
-- MVP works WITHOUT pgvector/embeddings. Future semantic retrieval may add
-- embedding columns to case-scoped memory records — not required for MVP.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. Case Layer — case-scoped continuity (NOT global user profiling)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'closed', 'archived'))
);

CREATE INDEX IF NOT EXISTS cases_user_id_idx ON cases(user_id);
CREATE INDEX IF NOT EXISTS cases_created_at_idx ON cases(created_at);

COMMENT ON TABLE cases IS
  'Case-scoped continuity container — all memory and interactions belong to a case, not global user profiles.';

-- ---------------------------------------------------------------------------
-- 2. Event Layer — append-only system events (never mutate history)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS system_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NULL REFERENCES cases(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL
    CHECK (event_type IN (
      'document_uploaded',
      'document_processed',
      'interaction_created',
      'risk_detected',
      'decision_generated',
      'case_updated',
      'notification_sent'
    )),
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS system_events_case_id_idx ON system_events(case_id);
CREATE INDEX IF NOT EXISTS system_events_user_id_idx ON system_events(user_id);
CREATE INDEX IF NOT EXISTS system_events_event_type_idx ON system_events(event_type);
CREATE INDEX IF NOT EXISTS system_events_created_at_idx ON system_events(created_at);

COMMENT ON TABLE system_events IS
  'Append-only domain event log — INSERT only; history is never updated or deleted.';
COMMENT ON COLUMN system_events.case_id IS
  'Nullable for user-scoped events before case assignment.';

-- Future: case-scoped memory records may add embedding vector(1536) columns
-- for semantic retrieval. MVP does NOT require pgvector extension here.

-- Drift prevention: cases + events are architecture foundation — not dashboards or workflows.
