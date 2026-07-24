-- Final output contract — single canonical output schema.
-- Run: psql $DATABASE_URL -f db/migrations/035_final_output_contract.sql

CREATE TABLE IF NOT EXISTS care_final_outputs (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  what_is_happening TEXT NOT NULL,
  what_matters_now TEXT NOT NULL,
  what_to_ask_next TEXT NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  what_can_wait TEXT NOT NULL,
  follow_up_items JSONB NOT NULL DEFAULT '[]',
  decision_trace JSONB NOT NULL DEFAULT '{}',
  confidence_state JSONB NOT NULL DEFAULT '{}',
  compiled_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS care_final_outputs_caregiver_idx
  ON care_final_outputs (caregiver_id, compiled_at DESC);

COMMENT ON TABLE care_final_outputs IS
  'Canonical SolenOS output — the one and only allowed user-facing response structure.';
