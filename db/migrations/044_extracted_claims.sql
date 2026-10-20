-- ============================================================
-- SolenOS Claim Consistency Confirmation Gate
-- Migration 044: extracted_claims table
-- ============================================================

-- Table: extracted_claims
-- Stores reconciled claims from the two-run confirmation gate.
-- A claim may only be stored as "confirmed" if two independent
-- extraction runs produced matching claims and agreed on
-- entity_type, event_type, and confidence_tag.

CREATE TABLE IF NOT EXISTS extracted_claims (
  id TEXT PRIMARY KEY,
  evidence_id TEXT NOT NULL,
  raw_input_id TEXT NOT NULL,
  claim_text TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  event_type TEXT NOT NULL,
  confidence_tag TEXT NOT NULL,
  source_span_start INTEGER,
  source_span_end INTEGER,
  source_span_text TEXT,
  run_a_id TEXT NOT NULL,
  run_b_id TEXT NOT NULL,
  reconciled_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_extracted_claims_evidence
  ON extracted_claims (evidence_id);

CREATE INDEX IF NOT EXISTS idx_extracted_claims_confidence
  ON extracted_claims (confidence_tag);

-- Database constraint: confirmed claims MUST have non-null source spans
-- and must have come through the confirmation gate (both run IDs present).
-- This is a defense-in-depth check; the primary enforcement is in application code.
CREATE OR REPLACE FUNCTION check_confirmed_claim_constraint()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.confidence_tag = 'confirmed' THEN
    IF NEW.source_span_start IS NULL OR NEW.source_span_end IS NULL THEN
      RAISE EXCEPTION 'confirmed claim must have valid source span';
    END IF;
    IF NEW.run_a_id IS NULL OR NEW.run_b_id IS NULL THEN
      RAISE EXCEPTION 'confirmed claim must have both run IDs';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_confirmed_claim
  BEFORE INSERT OR UPDATE ON extracted_claims
  FOR EACH ROW
  EXECUTE FUNCTION check_confirmed_claim_constraint();
