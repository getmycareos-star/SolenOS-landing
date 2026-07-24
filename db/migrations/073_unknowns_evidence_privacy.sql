-- Explicit Unknowns Engine (disease-agnostic) + presentation/evidence/privacy contracts.
-- Dementia is the first clinical profile, not a forked CareContext.

CREATE TABLE IF NOT EXISTS clinical_unknowns_log (
  id TEXT PRIMARY KEY,
  care_recipient_id TEXT,
  clinical_profile_id TEXT NOT NULL DEFAULT 'dementia',
  unknown_id TEXT NOT NULL,
  category TEXT,
  missing_information TEXT NOT NULL,
  priority TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unresolved',
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE clinical_unknowns_log IS
  'Explicit Unknowns from disease-agnostic engine; profile_id selects dementia/parkinsons/etc.';

CREATE TABLE IF NOT EXISTS evidence_conclusion_log (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT,
  recommendation TEXT,
  confidence_score NUMERIC,
  event_ids TEXT[] NOT NULL DEFAULT '{}',
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE evidence_conclusion_log IS
  'Evidence preservation — conclusions traceable to CareEvents; never AI decree.';
