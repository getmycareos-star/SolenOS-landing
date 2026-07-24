-- Universal Knowledge Extraction — structured knowledge from documents.
-- Run: psql $DATABASE_URL -f db/migrations/022_universal_knowledge_extraction.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS document_knowledge_items (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  caregiver_id TEXT NOT NULL,
  case_id UUID NULL REFERENCES cases(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  domain TEXT NOT NULL,
  label TEXT NOT NULL,
  value TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}',
  review_status TEXT NOT NULL DEFAULT 'approved',
  linked_journey_event_id TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_knowledge_relationships (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  from_item_id TEXT NOT NULL REFERENCES document_knowledge_items(id) ON DELETE CASCADE,
  to_item_id TEXT NOT NULL REFERENCES document_knowledge_items(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS document_knowledge_items_caregiver_idx
  ON document_knowledge_items (caregiver_id, created_at DESC);

CREATE INDEX IF NOT EXISTS document_knowledge_items_document_idx
  ON document_knowledge_items (document_id);

COMMENT ON TABLE document_knowledge_items IS
  'Structured knowledge extracted from documents — evidence-backed, not file storage.';

COMMENT ON TABLE document_knowledge_relationships IS
  'Relationships between extracted knowledge items within and across documents.';
