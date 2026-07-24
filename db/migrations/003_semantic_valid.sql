-- SolenOS implementation enforcement — semantic validation on interactions.
-- Run: psql $DATABASE_URL -f db/migrations/003_semantic_valid.sql

ALTER TABLE interactions
  ADD COLUMN IF NOT EXISTS semantic_valid BOOLEAN NOT NULL DEFAULT true;

-- Expand risk_level check for critical tier (application layer enforces enum).
COMMENT ON COLUMN interactions.semantic_valid IS 'Output passed semantic role isolation + compression gates';
