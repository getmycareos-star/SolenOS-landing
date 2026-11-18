-- Durable storage for server-side Ops Console events.
-- Browser telemetry remains disabled; only trusted server code can write here.
CREATE TABLE IF NOT EXISTS public.solen_events (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NULL,
  event_name TEXT NOT NULL,
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  session_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_solen_events_timestamp
  ON public.solen_events ("timestamp" DESC);

CREATE INDEX IF NOT EXISTS idx_solen_events_event_name_timestamp
  ON public.solen_events (event_name, "timestamp" DESC);

CREATE INDEX IF NOT EXISTS idx_solen_events_user_timestamp
  ON public.solen_events (user_id, "timestamp" DESC)
  WHERE user_id IS NOT NULL;

COMMENT ON TABLE public.solen_events IS
  'Internal server-side operational events. Not caregiver health records or browser telemetry.';
