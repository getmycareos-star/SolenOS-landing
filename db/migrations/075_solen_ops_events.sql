-- 075: Solen Ops events (product analytics for the Ops Console)
-- Written by src/lib/ops-console/insert-event.ts, read by src/lib/ops-console/queries.ts.
-- Ops-only surface: aggregate funnel and health counts, never care content.

CREATE TABLE IF NOT EXISTS solen_events (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT,
    event_name TEXT NOT NULL,
    session_id TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Funnel and health queries filter by event name and recency.
CREATE INDEX IF NOT EXISTS idx_solen_events_name ON solen_events(event_name);
CREATE INDEX IF NOT EXISTS idx_solen_events_timestamp ON solen_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_solen_events_user ON solen_events(user_id);
CREATE INDEX IF NOT EXISTS idx_solen_events_metadata ON solen_events USING GIN (metadata);
