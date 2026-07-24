-- Care Journey Graph — structured events + relationships (continuity engine core).
-- Run: psql $DATABASE_URL -f db/migrations/021_care_journey_graph.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS care_journey_graph_events (
  id TEXT PRIMARY KEY,
  journey_id TEXT NOT NULL,
  caregiver_id TEXT NOT NULL,
  case_id UUID NULL REFERENCES cases(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  description TEXT NOT NULL,
  people_involved JSONB NOT NULL DEFAULT '[]',
  location TEXT NULL,
  evidence JSONB NOT NULL DEFAULT '{}',
  related_event_ids JSONB NOT NULL DEFAULT '[]',
  clinical_importance TEXT NOT NULL DEFAULT 'informational',
  open_questions JSONB NOT NULL DEFAULT '[]',
  resolved_status TEXT NOT NULL DEFAULT 'open',
  source TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  attachments JSONB NOT NULL DEFAULT '[]',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS care_journey_graph_relationships (
  id TEXT PRIMARY KEY,
  journey_id TEXT NOT NULL,
  from_event_id TEXT NOT NULL REFERENCES care_journey_graph_events(id) ON DELETE CASCADE,
  to_event_id TEXT NOT NULL REFERENCES care_journey_graph_events(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN (
    'caused', 'resulted_in', 'followed_by', 'related_to', 'continued_from', 'changed_due_to', 'recommended'
  )),
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS care_journey_graph_events_caregiver_idx
  ON care_journey_graph_events (caregiver_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS care_journey_graph_events_journey_idx
  ON care_journey_graph_events (journey_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS care_journey_graph_relationships_journey_idx
  ON care_journey_graph_relationships (journey_id);

COMMENT ON TABLE care_journey_graph_events IS
  'Structured journey events — the core continuity object, not isolated timeline entries.';

COMMENT ON TABLE care_journey_graph_relationships IS
  'Causal and continuity relationships between journey events.';
