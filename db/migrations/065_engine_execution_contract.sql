-- Engine Execution Contract — registry of engine behavioral guarantees.
CREATE TABLE IF NOT EXISTS engine_execution_contract_log (
  id TEXT PRIMARY KEY,
  cycle_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  caregiver_id TEXT,
  contract_valid BOOLEAN NOT NULL,
  violations_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  registered_engines INTEGER NOT NULL
);
COMMENT ON TABLE engine_execution_contract_log IS 'Engine Execution Contract — emit-only, no CareContext mutation.';
