-- Event-Sourced Storage — append-only Event Store + projection snapshots.
CREATE TABLE IF NOT EXISTS solen_event_store (
  append_seq BIGSERIAL PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  care_recipient_id TEXT NOT NULL,
  caregiver_id TEXT NOT NULL,
  raw_observation TEXT NOT NULL,
  normalized_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL,
  event_timestamp TIMESTAMPTZ NOT NULL,
  linked_entities_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  appended_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS solen_care_context_projections (
  projection_id TEXT PRIMARY KEY,
  care_recipient_id TEXT NOT NULL,
  rebuilt_from_event_count INTEGER NOT NULL,
  rebuilt_at TIMESTAMPTZ NOT NULL,
  confidence_summary DOUBLE PRECISION NOT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE solen_event_store IS 'Append-only Event Store — source of truth. Never update or delete except legal override.';
COMMENT ON TABLE solen_care_context_projections IS 'CareContext projection — computed view, always rebuildable from Event Store.';
