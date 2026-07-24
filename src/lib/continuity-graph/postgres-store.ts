import type { Pool } from "pg";

import { createPostgresPool } from "../telemetry-persistence/postgres-store";
import type { ContinuityEdge, ContinuityGraph, ContinuityNode } from "./types";

function rowToNode(row: {
  id: string;
  graph_id: string;
  node_type: string;
  label: string;
  timestamp: string | null;
  domain: string;
  structured_data: Record<string, unknown>;
  source_event_id: string | null;
  source_document_id: string | null;
  confidence_level: string;
  resolved_status: string;
  created_at: string;
}): ContinuityNode {
  return {
    id: row.id,
    graph_id: row.graph_id,
    node_type: row.node_type as ContinuityNode["node_type"],
    label: row.label,
    timestamp: row.timestamp,
    domain: row.domain as ContinuityNode["domain"],
    structured_data: row.structured_data ?? {},
    source_event_id: row.source_event_id,
    source_document_id: row.source_document_id,
    confidence_level: row.confidence_level as ContinuityNode["confidence_level"],
    resolved_status: row.resolved_status as ContinuityNode["resolved_status"],
    created_at: row.created_at,
  };
}

function rowToEdge(row: {
  id: string;
  graph_id: string;
  from_node_id: string;
  to_node_id: string;
  edge_type: string;
  note: string;
  confidence_level: string;
  created_at: string;
}): ContinuityEdge {
  return {
    id: row.id,
    graph_id: row.graph_id,
    from_node_id: row.from_node_id,
    to_node_id: row.to_node_id,
    edge_type: row.edge_type as ContinuityEdge["edge_type"],
    note: row.note,
    confidence_level: row.confidence_level as ContinuityEdge["confidence_level"],
    created_at: row.created_at,
  };
}

async function getPool(): Promise<Pool | null> {
  return createPostgresPool();
}

export async function trySaveContinuityGraph(graph: ContinuityGraph): Promise<void> {
  const pool = await getPool();
  if (!pool) return;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const node of graph.nodes) {
      await client.query(
        `INSERT INTO continuity_graph_nodes (
          id, graph_id, caregiver_id, case_id, node_type, label, timestamp, domain,
          structured_data, source_event_id, source_document_id, confidence_level,
          resolved_status, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        ON CONFLICT (id) DO NOTHING`,
        [
          node.id,
          graph.graph_id,
          graph.caregiver_id,
          graph.case_id,
          node.node_type,
          node.label,
          node.timestamp,
          node.domain,
          JSON.stringify(node.structured_data),
          node.source_event_id,
          node.source_document_id,
          node.confidence_level,
          node.resolved_status,
          node.created_at,
        ],
      );
    }

    for (const edge of graph.edges) {
      await client.query(
        `INSERT INTO continuity_graph_edges (
          id, graph_id, from_node_id, to_node_id, edge_type, note, confidence_level, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (id) DO NOTHING`,
        [
          edge.id,
          graph.graph_id,
          edge.from_node_id,
          edge.to_node_id,
          edge.edge_type,
          edge.note,
          edge.confidence_level,
          edge.created_at,
        ],
      );
    }

    await client.query("COMMIT");
  } catch {
    await client.query("ROLLBACK");
  } finally {
    client.release();
  }
}

export async function tryLoadContinuityGraphForCaregiver(
  caregiverId: string,
): Promise<ContinuityGraph | null> {
  const pool = await getPool();
  if (!pool) return null;

  const nodeResult = await pool.query(
    `SELECT * FROM continuity_graph_nodes WHERE caregiver_id = $1 ORDER BY timestamp DESC NULLS LAST`,
    [caregiverId],
  );

  if (nodeResult.rows.length === 0) return null;

  const nodes = nodeResult.rows.map(rowToNode);
  const graphId = nodes[0]!.graph_id;

  const edgeResult = await pool.query(
    `SELECT * FROM continuity_graph_edges WHERE graph_id = $1`,
    [graphId],
  );

  return {
    graph_id: graphId,
    scope_id: `${caregiverId}::default`,
    caregiver_id: caregiverId,
    case_id: null,
    nodes,
    edges: edgeResult.rows.map(rowToEdge),
    updated_at: new Date().toISOString(),
  };
}
