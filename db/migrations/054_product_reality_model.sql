-- Product Reality Model — exhaustion, contradiction, incompleteness assumptions.
-- Run: psql $DATABASE_URL -f db/migrations/054_product_reality_model.sql

CREATE TABLE IF NOT EXISTS product_reality_model_log (
  model_id TEXT PRIMARY KEY,
  caregiver_id TEXT,
  event_driven BOOLEAN NOT NULL,
  contradiction_count INT NOT NULL DEFAULT 0,
  incomplete_fields_count INT NOT NULL DEFAULT 0,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE product_reality_model_log IS
  'Operating model validation — event-driven, conflict-aware, incomplete state.';
