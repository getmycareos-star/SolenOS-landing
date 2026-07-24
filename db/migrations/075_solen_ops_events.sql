-- SolenOS Ops Console — append-only product-learning events (internal analytics).
-- Run: psql $DATABASE_URL -f db/migrations/075_solen_ops_events.sql
-- NOT a user-facing surface. NOT Mixpanel/GA/Segment.

CREATE TABLE IF NOT EXISTS solen_events (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT,
  event_name TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  session_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_solen_events_timestamp
  ON solen_events (timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_solen_events_event
  ON solen_events (event_name);

CREATE INDEX IF NOT EXISTS idx_solen_events_user
  ON solen_events (user_id);

COMMENT ON TABLE solen_events IS
  'Ops Console event log — product learning / continuity signals. Insert-only; no BI platform.';
