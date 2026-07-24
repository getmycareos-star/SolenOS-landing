-- Support Signal System (SSS v1) — telemetry only (NOT interactions, NOT engagement metrics).
-- Run: psql $DATABASE_URL -f db/migrations/008_support_signal_telemetry.sql

CREATE TABLE IF NOT EXISTS support_signal_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_id TEXT NOT NULL,
  category TEXT NOT NULL,
  delivered_at TIMESTAMPTZ NULL,
  suppressed BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS support_signal_events_user_id_idx
  ON support_signal_events(user_id);

CREATE INDEX IF NOT EXISTS support_signal_events_delivered_at_idx
  ON support_signal_events(delivered_at);

COMMENT ON TABLE support_signal_events IS
  'SSS v1 telemetry — delivery/suppression only. Forbidden: engagement score, habit formation, retention optimization, dependency tracking.';

COMMENT ON COLUMN support_signal_events.notification_id IS
  'Static MessageTemplate id — not LLM-generated.';

COMMENT ON COLUMN support_signal_events.category IS
  'SupportState / template category at evaluation time.';

COMMENT ON COLUMN support_signal_events.delivered_at IS
  'Null when suppressed or not delivered.';

COMMENT ON COLUMN support_signal_events.suppressed IS
  'True when evaluation chose silence due to suppression rules.';

-- Row Level Security (Supabase auth.uid() pattern — matches 005)
ALTER TABLE support_signal_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'support_signal_events'
      AND policyname = 'support_signal_events_user_isolation'
  ) THEN
    CREATE POLICY support_signal_events_user_isolation ON support_signal_events
      FOR ALL USING (user_id = auth.uid());
  END IF;
END $$;

-- Drift prevention: support signal telemetry is observational — not engagement or retention analytics.
