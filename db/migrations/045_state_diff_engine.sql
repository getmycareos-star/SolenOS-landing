-- ============================================================
-- SolenOS State-Diff Engine — "What Changed"
-- Migration 045: care_state_current, care_state_history, care_state_changes
-- ============================================================

-- Table: care_state_current
-- Current structured care state per person + domain + field.
-- Every field is traceable to its originating claim.

CREATE TABLE IF NOT EXISTS care_state_current (
  person_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  field TEXT NOT NULL,
  value TEXT NOT NULL,
  confidence_tag TEXT NOT NULL,
  source_claim_id TEXT NOT NULL,
  as_of TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (person_id, domain, field)
);

CREATE INDEX IF NOT EXISTS idx_care_state_current_person
  ON care_state_current (person_id);

CREATE INDEX IF NOT EXISTS idx_care_state_current_domain
  ON care_state_current (person_id, domain);

-- Table: care_state_history
-- Immutable chronological history of all state value changes.
-- Historical state must NEVER be destroyed when current state changes.

CREATE TABLE IF NOT EXISTS care_state_history (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  field TEXT NOT NULL,
  value TEXT NOT NULL,
  confidence_tag TEXT NOT NULL,
  source_claim_id TEXT NOT NULL,
  as_of TEXT NOT NULL,
  replaced_at TEXT NOT NULL,
  change_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_care_state_history_person
  ON care_state_history (person_id);

CREATE INDEX IF NOT EXISTS idx_care_state_history_domain
  ON care_state_history (person_id, domain, field);

CREATE INDEX IF NOT EXISTS idx_care_state_history_as_of
  ON care_state_history (person_id, domain, field, as_of);

-- Table: care_state_changes
-- Persistent ChangeRecord log — every detected change is recorded here.

CREATE TABLE IF NOT EXISTS care_state_changes (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  field TEXT NOT NULL,
  previous_value TEXT,
  new_value TEXT NOT NULL,
  detected_at TEXT NOT NULL,
  change_type TEXT NOT NULL CHECK (change_type IN ('new', 'changed', 'backfilled'))
);

CREATE INDEX IF NOT EXISTS idx_care_state_changes_person
  ON care_state_changes (person_id);

CREATE INDEX IF NOT EXISTS idx_care_state_changes_detected
  ON care_state_changes (person_id, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_care_state_changes_type
  ON care_state_changes (change_type);

-- Database constraint: unknown and contradictory claims must not silently
-- overwrite current state. This is enforced in application code; this
-- trigger provides defense-in-depth for INSERT/UPDATE paths.
CREATE OR REPLACE FUNCTION check_state_confidence_constraint()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.confidence_tag IN ('unknown', 'contradictory') THEN
    RAISE EXCEPTION 'state update from % claim must be handled by application logic', NEW.confidence_tag;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_state_confidence
  BEFORE INSERT OR UPDATE ON care_state_current
  FOR EACH ROW
  EXECUTE FUNCTION check_state_confidence_constraint();
