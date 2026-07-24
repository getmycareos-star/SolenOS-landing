-- Confidence Calibration System — deterministic evidence-strength scoring.
CREATE TABLE IF NOT EXISTS confidence_calibration_snapshots (
  id TEXT PRIMARY KEY,
  care_recipient_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  score DOUBLE PRECISION NOT NULL,
  factors_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  reason TEXT NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE confidence_calibration_snapshots IS 'Calibrated confidence — recency, contradiction, confirmation, completeness.';
