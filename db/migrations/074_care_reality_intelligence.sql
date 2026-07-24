-- Care Reality Intelligence — spine extensions (schema-only persistence; engines remain in-memory MVP).
-- Run: psql $DATABASE_URL -f db/migrations/074_care_reality_intelligence.sql

CREATE TABLE IF NOT EXISTS care_loop_outcomes (
  id TEXT PRIMARY KEY,
  care_recipient_id TEXT NOT NULL,
  decision_summary TEXT NOT NULL,
  intervention TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('helped', 'did_not_help', 'unknown', 'mixed')),
  evidence_event_ids TEXT[] NOT NULL DEFAULT '{}',
  confidence TEXT NOT NULL CHECK (confidence IN ('low', 'medium', 'high')),
  source TEXT NOT NULL CHECK (source IN ('profile_inference', 'caregiver_confirmed', 'system_inferred')),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE care_loop_outcomes IS
  'Decision memory + care-loop outcomes — what was tried and what happened afterward (Care Reality Intelligence spine).';

CREATE TABLE IF NOT EXISTS care_transition_signals (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  care_recipient_id TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_event_ids TEXT[] NOT NULL DEFAULT '{}',
  summary TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'signal_only' CHECK (mode IN ('signal_only', 'transition_mode')),
  uncertainties JSONB NOT NULL DEFAULT '[]'::jsonb
);

COMMENT ON TABLE care_transition_signals IS
  'Care transition gap signals — FUTURE: temporary Care Transition Mode briefs.';

CREATE TABLE IF NOT EXISTS care_reality_intelligence_snapshots (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  care_recipient_id TEXT NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  intelligence_chain JSONB NOT NULL DEFAULT '[]'::jsonb,
  capabilities_active JSONB NOT NULL DEFAULT '[]'::jsonb,
  care_loop_outcomes JSONB NOT NULL DEFAULT '[]'::jsonb,
  care_transition_signals JSONB NOT NULL DEFAULT '[]'::jsonb,
  person_specific_summary TEXT,
  trust_rules_upheld JSONB NOT NULL DEFAULT '[]'::jsonb
);

COMMENT ON TABLE care_reality_intelligence_snapshots IS
  'Composed Care Reality Intelligence facade snapshot — events→changes→decisions→outcomes→context→confidence.';

CREATE INDEX IF NOT EXISTS idx_care_loop_outcomes_recipient
  ON care_loop_outcomes (care_recipient_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_care_transition_signals_recipient
  ON care_transition_signals (care_recipient_id, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_cri_snapshots_recipient
  ON care_reality_intelligence_snapshots (care_recipient_id, computed_at DESC);
