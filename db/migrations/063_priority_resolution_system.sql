-- Priority Resolution System — single dominant output mode per cycle.
CREATE TABLE IF NOT EXISTS priority_resolution_log (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  dominant_mode TEXT NOT NULL,
  suppressed_modes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  selection_reason TEXT NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE priority_resolution_log IS 'Priority Resolution — exactly one dominant output mode per input cycle.';
