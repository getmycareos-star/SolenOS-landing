-- Edge State Machine — operational state classification before output.
CREATE TABLE IF NOT EXISTS edge_state_classifications (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  care_recipient_id TEXT,
  edge_state TEXT NOT NULL,
  classification_reason TEXT NOT NULL,
  banner_message TEXT,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE edge_state_classifications IS 'Edge State Machine — bootstrap|degraded|stale|conflict|crisis|normal.';
