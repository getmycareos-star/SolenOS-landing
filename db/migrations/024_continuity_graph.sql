-- Universal Continuity Graph — domain-agnostic nodes and edges.
-- Run: psql $DATABASE_URL -f db/migrations/024_continuity_graph.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS continuity_graph_nodes (
  id TEXT PRIMARY KEY,
  graph_id TEXT NOT NULL,
  caregiver_id TEXT NOT NULL,
  case_id UUID NULL REFERENCES cases(id) ON DELETE SET NULL,
  node_type TEXT NOT NULL CHECK (node_type IN (
    'Person', 'Entity', 'Event', 'Condition', 'Action', 'Decision',
    'Document', 'Obligation', 'Resource', 'Constraint'
  )),
  label TEXT NOT NULL,
  timestamp TIMESTAMPTZ NULL,
  domain TEXT NOT NULL DEFAULT 'mixed' CHECK (domain IN (
    'care', 'legal', 'financial', 'administrative', 'family', 'mixed'
  )),
  structured_data JSONB NOT NULL DEFAULT '{}',
  source_event_id TEXT NULL,
  source_document_id TEXT NULL,
  confidence_level TEXT NOT NULL DEFAULT 'medium',
  resolved_status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS continuity_graph_edges (
  id TEXT PRIMARY KEY,
  graph_id TEXT NOT NULL,
  from_node_id TEXT NOT NULL REFERENCES continuity_graph_nodes(id) ON DELETE CASCADE,
  to_node_id TEXT NOT NULL REFERENCES continuity_graph_nodes(id) ON DELETE CASCADE,
  edge_type TEXT NOT NULL CHECK (edge_type IN (
    'causes', 'precedes', 'follows', 'modifies', 'triggers',
    'depends_on', 'resolves', 'relates_to', 'blocks'
  )),
  note TEXT NOT NULL DEFAULT '',
  confidence_level TEXT NOT NULL DEFAULT 'medium',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS continuity_graph_nodes_caregiver_idx
  ON continuity_graph_nodes (caregiver_id, timestamp DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS continuity_graph_nodes_graph_idx
  ON continuity_graph_nodes (graph_id);

CREATE INDEX IF NOT EXISTS continuity_graph_edges_graph_idx
  ON continuity_graph_edges (graph_id);

COMMENT ON TABLE continuity_graph_nodes IS
  'Universal continuity graph nodes — domain-agnostic real-world entities, events, and obligations.';

COMMENT ON TABLE continuity_graph_edges IS
  'Universal continuity graph edges — temporal and causal dependencies between nodes.';
