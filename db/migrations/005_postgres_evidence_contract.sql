-- PostgreSQL Evidence Contract — interaction ledger + grounding + safety facts.
-- NOT caregiver memory, longitudinal tracking, or behavioral analytics.
-- Run: psql $DATABASE_URL -f db/migrations/005_postgres_evidence_contract.sql
--
-- Supabase: RLS policies use auth.uid(). App layer uses backend service role key.
-- Standard Postgres without Supabase auth: RLS policies are inert until auth.uid() exists.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------------------
-- 1. Identity Layer — users (minimal, auth optional)
-- ---------------------------------------------------------------------------

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email TEXT NULL,
  ADD COLUMN IF NOT EXISTS password_hash TEXT NULL,
  ADD COLUMN IF NOT EXISTS auth_enabled BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx
  ON users (email) WHERE email IS NOT NULL;

COMMENT ON COLUMN users.trust_score IS
  'DEPRECATED — violates postgres evidence contract (user scoring forbidden). Retained for migration compatibility only.';

COMMENT ON COLUMN users.email IS 'Optional identity — auth provider TBD; no demographics.';
COMMENT ON COLUMN users.password_hash IS 'Optional local auth hash — null when auth_enabled is false.';
COMMENT ON COLUMN users.auth_enabled IS 'When false, user rows are anonymous ledger keys only.';

-- ---------------------------------------------------------------------------
-- 2. Document Layer
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  extracted_text TEXT NULL,
  structured_output JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS documents_user_id_idx ON documents(user_id);
CREATE INDEX IF NOT EXISTS documents_created_at_idx ON documents(created_at);

-- ---------------------------------------------------------------------------
-- 3. Interaction Ledger — align relief_signal + per-interaction relief fields
-- ---------------------------------------------------------------------------

-- Convert legacy boolean relief_signal to float when present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'interactions' AND column_name = 'relief_signal'
      AND data_type = 'boolean'
  ) THEN
    ALTER TABLE interactions
      ALTER COLUMN relief_signal TYPE DOUBLE PRECISION
      USING CASE
        WHEN relief_signal IS TRUE THEN 1.0
        WHEN relief_signal IS FALSE THEN 0.0
        ELSE NULL
      END;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'interactions' AND column_name = 'relief_signal'
  ) THEN
    ALTER TABLE interactions ADD COLUMN relief_signal DOUBLE PRECISION NULL;
  END IF;
END $$;

ALTER TABLE interactions
  ADD COLUMN IF NOT EXISTS helpful_yes_no BOOLEAN NULL,
  ADD COLUMN IF NOT EXISTS reduced_confusion_yes_no BOOLEAN NULL;

COMMENT ON COLUMN interactions.relief_signal IS
  'Relief signal float — measurement only, not user scoring.';
COMMENT ON COLUMN interactions.helpful_yes_no IS
  'Interaction-bound relief validation — copied from feedback when submitted.';
COMMENT ON COLUMN interactions.reduced_confusion_yes_no IS
  'Interaction-bound relief validation — copied from feedback when submitted.';

-- ---------------------------------------------------------------------------
-- 4. Grounding Layer — knowledge_base with pgvector
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk TEXT NOT NULL,
  embedding vector(1536) NULL,
  category TEXT NULL,
  source TEXT NULL
);

CREATE INDEX IF NOT EXISTS knowledge_base_category_idx ON knowledge_base(category);

-- ---------------------------------------------------------------------------
-- 5. Safety Validation Layer — policy_facts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS policy_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS policy_facts_category_key_idx
  ON policy_facts (category, key);

-- ---------------------------------------------------------------------------
-- Row Level Security (Supabase auth.uid() — user-scoped tables only)
-- ---------------------------------------------------------------------------

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- knowledge_base and policy_facts are system-scoped grounding/safety facts (no user_id).
-- Backend service role bypasses RLS; do not expose write paths to clients.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'documents' AND policyname = 'documents_user_isolation'
  ) THEN
    CREATE POLICY documents_user_isolation ON documents
      FOR ALL USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'interactions' AND policyname = 'interactions_user_isolation'
  ) THEN
    CREATE POLICY interactions_user_isolation ON interactions
      FOR ALL USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'feedback' AND policyname = 'feedback_user_isolation'
  ) THEN
    CREATE POLICY feedback_user_isolation ON feedback
      FOR ALL USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'users_self_isolation'
  ) THEN
    CREATE POLICY users_self_isolation ON users
      FOR ALL USING (id = auth.uid());
  END IF;
END $$;

-- Drift prevention: Postgres is evidence + grounding only — not a care record.
