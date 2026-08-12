-- ============================================================
-- SolenOS Trust & Reliability Layer
-- Migration 046: raw_evidence, claim_corrections, caregiver_vocabulary
-- ============================================================

-- ─── Table: raw_evidence ─────────────────────────────────────────
-- Every caregiver input MUST be persisted here BEFORE any AI
-- processing begins. If extraction fails, the evidence remains
-- retrievable.
CREATE TABLE IF NOT EXISTS raw_evidence (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  person_id TEXT,
  input_type TEXT NOT NULL CHECK (input_type IN ('text','ocr_text','pdf','image','voice_transcript','message','import')),
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  ocr_confidence NUMERIC,
  document_id TEXT,
  document_name TEXT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  urgency_risk_level TEXT CHECK (urgency_risk_level IN ('low','medium','high','critical')),
  urgency_signals TEXT[],
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_raw_evidence_caregiver
  ON raw_evidence (caregiver_id);

CREATE INDEX IF NOT EXISTS idx_raw_evidence_captured
  ON raw_evidence (caregiver_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_raw_evidence_person
  ON raw_evidence (person_id) WHERE person_id IS NOT NULL;

-- ─── Table: claim_corrections ────────────────────────────────────
-- Append-only correction log linked to extracted_claims.
-- Never deletes original claims. Preserves full history.
CREATE TABLE IF NOT EXISTS claim_corrections (
  id TEXT PRIMARY KEY,
  original_claim_id TEXT NOT NULL REFERENCES extracted_claims(id) ON DELETE RESTRICT,
  person_id TEXT,
  caregiver_id TEXT NOT NULL,
  correction_type TEXT NOT NULL CHECK (
    correction_type IN (
      'wrong_entity','wrong_event_type','wrong_value',
      'wrong_timestamp','not_new','duplicate','irrelevant','other'
    )
  ),
  original_value JSONB,
  corrected_value JSONB,
  rationale TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_claim_corrections_claim
  ON claim_corrections (original_claim_id);

CREATE INDEX IF NOT EXISTS idx_claim_corrections_caregiver
  ON claim_corrections (caregiver_id);

-- ─── Table: caregiver_vocabulary ─────────────────────────────────
-- Caregiver-specific vocabulary mapping.
-- Repeatable: same phrase -> same meaning.
-- Reversible: each mapping tracked with usage count.
-- Auditable: created_at, updated_at stored.
CREATE TABLE IF NOT EXISTS caregiver_vocabulary (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  phrase TEXT NOT NULL,
  mapped_to TEXT NOT NULL,
  domain TEXT,
  confidence_tag TEXT NOT NULL CHECK (
    confidence_tag IN ('confirmed','reported','inferred','unknown','contradictory')
  ),
  usage_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (caregiver_id, phrase, mapped_to)
);

CREATE INDEX IF NOT EXISTS idx_caregiver_vocabulary_caregiver
  ON caregiver_vocabulary (caregiver_id);

CREATE INDEX IF NOT EXISTS idx_caregiver_vocabulary_phrase
  ON caregiver_vocabulary (caregiver_id, phrase);

-- ─── Fix: strengthen confidence-source constraint ────────────────
-- Migration 044 used a trigger on 'confirmed' only. Per spec §7,
-- BOTH 'confirmed' and 'reported' tags MUST carry a non-null source
-- span. Replace the trigger with a CHECK constraint that covers both.
DROP TRIGGER IF EXISTS trg_check_confirmed_claim ON extracted_claims;
DROP FUNCTION IF EXISTS check_confirmed_claim_constraint();

ALTER TABLE extracted_claims
  ADD CONSTRAINT chk_confirmed_reported_source_span
  CHECK (
    (
      confidence_tag IN ('confirmed', 'reported')
      AND source_span_start IS NOT NULL
      AND source_span_end IS NOT NULL
    )
    OR confidence_tag IN ('inferred', 'unknown', 'contradictory')
  );

-- ─── Strengthen: raw_evidence content must never be empty ────────
ALTER TABLE raw_evidence
  ADD CONSTRAINT chk_raw_evidence_nonempty
  CHECK (LENGTH(TRIM(content)) > 0);
