-- Continuity properties (SRL / EUM / OML / FDLL) — attributes of CareEvent→CareContext, not a separate product.

CREATE TABLE IF NOT EXISTS continuity_properties_log (

  id TEXT PRIMARY KEY,

  caregiver_id TEXT,

  care_recipient_id TEXT,

  outcome_trend TEXT,

  cognitive_load_score NUMERIC,

  unknown_count INTEGER NOT NULL DEFAULT 0,

  failure_categories TEXT[] NOT NULL DEFAULT '{}',

  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,

  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

);

COMMENT ON TABLE continuity_properties_log IS

  'Vertical Continuity refinement snapshots — outcome measurement, unknowns, reliability, failure signals.';



CREATE TABLE IF NOT EXISTS inference_feedback_log (

  id TEXT PRIMARY KEY,

  inference_id TEXT NOT NULL,

  verdict TEXT NOT NULL,

  engine_source TEXT,

  feedback_source_reliability NUMERIC,

  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,

  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

);

COMMENT ON TABLE inference_feedback_log IS

  'FDLL — explicit caregiver feedback only; never learn from implicit signals alone.';


