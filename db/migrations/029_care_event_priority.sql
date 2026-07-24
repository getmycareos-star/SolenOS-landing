-- CareEvent priority scoring fields (deterministic ranking layer).
-- Run: psql $DATABASE_URL -f db/migrations/029_care_event_priority.sql

ALTER TABLE care_context_events
  ADD COLUMN IF NOT EXISTS priority JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS care_context_events_priority_score_idx
  ON care_context_events ((priority->>'priority_score') DESC NULLS LAST);

COMMENT ON COLUMN care_context_events.priority IS
  'Deterministic priority: urgency, uncertainty, dependency_count, recency_days, priority_score, tier.';
