-- Product North Star — constraint evaluations and demand classifications.
CREATE TABLE IF NOT EXISTS product_north_star_log (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT,
  demand_type TEXT,
  output_answers_memory_questions BOOLEAN NOT NULL DEFAULT FALSE,
  feature_gate_passed BOOLEAN NOT NULL DEFAULT TRUE,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE product_north_star_log IS
  'North Star gate — reduce memory reconstruction; questions are continuity symptoms not answer requests.';
