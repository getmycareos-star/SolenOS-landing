import { detectCascadeChains } from "./graph-store";
import type { ContinuityGraph, ContinuityIntelligenceInsight, ContinuityNode } from "./types";

export function detectMissingObligations(graph: ContinuityGraph): ContinuityIntelligenceInsight[] {
  const insights: ContinuityIntelligenceInsight[] = [];

  for (const node of graph.nodes) {
    if (node.node_type !== "Obligation") continue;
    if (node.resolved_status === "resolved") continue;

    const hasResolution = graph.edges.some(
      (e) => e.to_node_id === node.id && e.edge_type === "resolves",
    );

    if (!hasResolution) {
      insights.push({
        insight_id: `obl_${node.id}`,
        insight_type: "missing_obligation",
        summary: `Unresolved obligation: ${node.label}`,
        node_ids: [node.id],
        domain: node.domain,
      });
    }
  }

  return insights.slice(0, 5);
}

export function detectUnresolvedDecisions(graph: ContinuityGraph): ContinuityIntelligenceInsight[] {
  const insights: ContinuityIntelligenceInsight[] = [];

  for (const node of graph.nodes) {
    if (node.node_type !== "Decision") continue;
    if (node.resolved_status === "resolved") continue;

    insights.push({
      insight_id: `dec_${node.id}`,
      insight_type: "unresolved_decision",
      summary: `Decision recorded without downstream resolution: ${node.label}`,
      node_ids: [node.id],
      domain: node.domain,
    });
  }

  return insights.slice(0, 5);
}

export function detectDependencyGaps(graph: ContinuityGraph): ContinuityIntelligenceInsight[] {
  const insights: ContinuityIntelligenceInsight[] = [];

  for (const edge of graph.edges) {
    if (edge.edge_type !== "depends_on") continue;
    const target = graph.nodes.find((n) => n.id === edge.to_node_id);
    if (!target) continue;
    if (target.resolved_status === "resolved") continue;

    insights.push({
      insight_id: `dep_${edge.id}`,
      insight_type: "dependency_gap",
      summary: `A downstream action depends on unresolved state: ${target.label}`,
      node_ids: [edge.from_node_id, edge.to_node_id],
      domain: target.domain,
    });
  }

  return insights.slice(0, 5);
}

export function runContinuityIntelligence(graph: ContinuityGraph): ContinuityIntelligenceInsight[] {
  const cascades = detectCascadeChains(graph).map((c) => ({
    insight_id: c.chain_id,
    insight_type: "cascade_chain" as const,
    summary: c.summary,
    node_ids: c.node_ids,
    domain: c.domain,
  }));

  return [
    ...cascades,
    ...detectMissingObligations(graph),
    ...detectUnresolvedDecisions(graph),
    ...detectDependencyGaps(graph),
  ].slice(0, 10);
}
