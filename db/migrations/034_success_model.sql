-- Success model — outcome metrics over activity metrics.
-- Run: psql $DATABASE_URL -f db/migrations/034_success_model.sql

CREATE TABLE IF NOT EXISTS care_success_snapshots (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  overall_success_score INT NOT NULL,
  overall_level TEXT NOT NULL CHECK (
    overall_level IN ('strong', 'moderate', 'weak', 'insufficient')
  ),
  primary_scores JSONB NOT NULL DEFAULT '{}',
  system_quality_scores JSONB NOT NULL DEFAULT '{}',
  user_trust_scores JSONB NOT NULL DEFAULT '{}',
  longitudinal_scores JSONB NOT NULL DEFAULT '{}',
  outcome_summary TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS care_recall_probes (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  question TEXT NOT NULL,
  answered BOOLEAN NOT NULL,
  from_continuity BOOLEAN NOT NULL,
  evidence_event_ids JSONB NOT NULL DEFAULT '[]',
  probed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS care_feature_acceptance (
  id TEXT PRIMARY KEY,
  feature_name TEXT NOT NULL,
  accepted BOOLEAN NOT NULL,
  yes_count INT NOT NULL,
  required_yes INT NOT NULL,
  answers JSONB NOT NULL DEFAULT '[]',
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS care_success_snapshots_caregiver_idx
  ON care_success_snapshots (caregiver_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS care_recall_probes_caregiver_idx
  ON care_recall_probes (caregiver_id, probed_at DESC);

COMMENT ON TABLE care_success_snapshots IS
  'Outcome success metrics — cognitive load, continuity, prep, follow-ups, recall.';

COMMENT ON TABLE care_recall_probes IS
  'Recall accuracy probes — answers from Care Context not keyword search.';

COMMENT ON TABLE care_feature_acceptance IS
  'Feature acceptance gate — must pass outcome metric evaluation before build.';
