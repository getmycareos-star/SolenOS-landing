-- Product Constitution — Living Care Record projections and confidence snapshots.

CREATE TABLE IF NOT EXISTS product_constitution_log (

  id TEXT PRIMARY KEY,

  care_recipient_id TEXT,

  caregiver_id TEXT,

  understanding_level TEXT,

  information_gap_count INTEGER NOT NULL DEFAULT 0,

  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,

  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

);

COMMENT ON TABLE product_constitution_log IS

  'Product Constitution — CareRecord spine and Daily Care Confidence projections; documents are inputs only.';

