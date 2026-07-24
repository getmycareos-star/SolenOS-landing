-- Care State Engine — Care Reality primary object (narrow MVP).
CREATE TABLE IF NOT EXISTS care_state_snapshots (
  id TEXT PRIMARY KEY,
  care_recipient_id TEXT NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  change_detected BOOLEAN NOT NULL DEFAULT FALSE,
  care_state_json JSONB NOT NULL DEFAULT '{}'::jsonb
);
COMMENT ON TABLE care_state_snapshots IS 'Care State — evolving understanding of care reality; documents are inputs only.';
