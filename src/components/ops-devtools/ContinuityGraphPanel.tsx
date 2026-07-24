"use client";

import { useCallback, useEffect, useState } from "react";

import type {
  ContinuityEdge,
  ContinuityGraph,
  ContinuityIntelligenceInsight,
  ContinuityNode,
  ContextReasoningOutput,
} from "@/lib/continuity-graph";

type Props = {
  className?: string;
};

type GraphResponse = {
  graph: ContinuityGraph;
  total_nodes: number;
  total_edges: number;
  cascade_chains: { summary: string }[];
  context_reasoning: ContextReasoningOutput | null;
  continuity_insights: ContinuityIntelligenceInsight[];
};

const NODE_TYPE_COLORS: Record<ContinuityNode["node_type"], string> = {
  Person: "var(--accent-care, #5b8def)",
  Entity: "var(--accent-entity, #7c6cf0)",
  Event: "var(--accent-event, #e07a5f)",
  Condition: "var(--accent-condition, #f2cc8f)",
  Action: "var(--accent-action, #81b29a)",
  Decision: "var(--accent-decision, #3d405b)",
  Document: "var(--accent-document, #9a8c98)",
  Obligation: "var(--accent-obligation, #e63946)",
  Resource: "var(--accent-resource, #457b9d)",
  Constraint: "var(--accent-constraint, #6d6875)",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function edgesForNode(nodeId: string, edges: ContinuityEdge[]): ContinuityEdge[] {
  return edges.filter((e) => e.from_node_id === nodeId || e.to_node_id === nodeId);
}

export function ContinuityGraphPanel({ className }: Props) {
  const [data, setData] = useState<GraphResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/continuity-graph");
      if (!res.ok) throw new Error("Could not load continuity graph");
      const json = (await res.json()) as GraphResponse;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load graph");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const graph = data?.graph ?? null;
  const sortedNodes = [...(graph?.nodes ?? [])].sort((a, b) => {
    const ta = a.timestamp ?? a.created_at;
    const tb = b.timestamp ?? b.created_at;
    return tb.localeCompare(ta);
  });

  return (
    <section
      className={className}
      aria-labelledby="continuity-graph-heading"
      data-testid="continuity-graph-panel"
    >
      <header className="panel-header">
        <h3 id="continuity-graph-heading">Continuity Graph</h3>
        <p className="panel-subtitle">
          A time-evolving dependency graph of real-world events, decisions, and obligations — not
          limited to medical context.
        </p>
      </header>

      {loading && <p className="panel-muted">Loading continuity graph…</p>}
      {error && (
        <p className="workspace-error" role="alert">
          {error}
        </p>
      )}

      {!loading && graph && graph.nodes.length === 0 && (
        <p className="panel-muted">
          No continuity nodes yet. Record events — fall, legal documents, payments, appointments —
          and the graph will connect them over time.
        </p>
      )}

      {graph && graph.nodes.length > 0 && (
        <>
          <div className="continuity-graph-stats" aria-label="Graph statistics">
            <span>{data?.total_nodes ?? 0} nodes</span>
            <span>{data?.total_edges ?? 0} edges</span>
          </div>

          {data?.cascade_chains && data.cascade_chains.length > 0 && (
            <div className="continuity-insights" aria-label="Cascade chains">
              <h4>Cascading continuity</h4>
              <ul>
                {data.cascade_chains.map((chain, i) => (
                  <li key={`chain_${i}`}>{chain.summary}</li>
                ))}
              </ul>
            </div>
          )}

          {data?.continuity_insights && data.continuity_insights.length > 0 && (
            <div className="continuity-insights" aria-label="Continuity intelligence">
              <h4>Structure detected</h4>
              <ul>
                {data.continuity_insights.slice(0, 5).map((insight) => (
                  <li key={insight.insight_id}>{insight.summary}</li>
                ))}
              </ul>
            </div>
          )}

          {data?.context_reasoning &&
            (data.context_reasoning.known.length > 0 ||
              data.context_reasoning.unknown.length > 0) && (
              <div className="context-reasoning" aria-label="Context reasoning">
                <h4>Context reasoning</h4>
                {data.context_reasoning.known.length > 0 && (
                  <>
                    <p className="panel-label">Known</p>
                    <ul>
                      {data.context_reasoning.known.map((k, i) => (
                        <li key={`known_${i}`}>{k}</li>
                      ))}
                    </ul>
                  </>
                )}
                {data.context_reasoning.unknown.length > 0 && (
                  <>
                    <p className="panel-label">Unknown</p>
                    <ul>
                      {data.context_reasoning.unknown.map((u, i) => (
                        <li key={`unknown_${i}`}>{u}</li>
                      ))}
                    </ul>
                  </>
                )}
                <p className="panel-muted">
                  Confidence: {data.context_reasoning.confidence}
                </p>
              </div>
            )}

          <ul className="continuity-node-list" aria-label="Continuity nodes">
            {sortedNodes.slice(0, 20).map((node) => {
              const nodeEdges = edgesForNode(node.id, graph.edges);
              return (
                <li key={node.id} className="continuity-node-item">
                  <div className="continuity-node-header">
                    <span
                      className="continuity-node-type"
                      style={{ color: NODE_TYPE_COLORS[node.node_type] }}
                    >
                      {node.node_type}
                    </span>
                    <span className="continuity-node-domain">{node.domain}</span>
                    <time dateTime={node.timestamp ?? undefined}>
                      {formatDate(node.timestamp)}
                    </time>
                  </div>
                  <p className="continuity-node-label">{node.label}</p>
                  {nodeEdges.length > 0 && (
                    <ul className="continuity-edge-list">
                      {nodeEdges.slice(0, 3).map((edge) => {
                        const isOutgoing = edge.from_node_id === node.id;
                        const otherId = isOutgoing ? edge.to_node_id : edge.from_node_id;
                        const other = graph.nodes.find((n) => n.id === otherId);
                        return (
                          <li key={edge.id}>
                            {isOutgoing ? "→" : "←"} {edge.edge_type}:{" "}
                            {other?.label ?? otherId}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      <button type="button" className="linkish" onClick={() => void load()}>
        Refresh graph
      </button>
    </section>
  );
}
