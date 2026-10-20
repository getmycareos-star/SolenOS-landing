import type { ContinuityEdge, ContinuityGraph, ContinuityNode, CascadeChain } from "./types";

const graphs = new Map<string, ContinuityGraph>();
const scopeIndex = new Map<string, string>();

function scopeKey(caregiverId: string, caseId: string | null): string {
  return `${caregiverId}::${caseId ?? "default"}`;
}

export function createGraphId(): string {
  return `ucg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createNodeId(): string {
  return `cn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createEdgeId(): string {
  return `ce_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function getOrCreateContinuityGraph(
  caregiverId: string,
  caseId: string | null,
): ContinuityGraph {
  const key = scopeKey(caregiverId, caseId);
  const existingId = scopeIndex.get(key);
  if (existingId) {
    const g = graphs.get(existingId);
    if (g) return g;
  }

  const now = new Date().toISOString();
  const graph: ContinuityGraph = {
    graph_id: createGraphId(),
    scope_id: key,
    caregiver_id: caregiverId,
    case_id: caseId,
    nodes: [],
    edges: [],
    updated_at: now,
  };
  graphs.set(graph.graph_id, graph);
  scopeIndex.set(key, graph.graph_id);
  return graph;
}

export function getContinuityGraph(graphId: string): ContinuityGraph | undefined {
  return graphs.get(graphId);
}

export function getContinuityGraphForScope(
  caregiverId: string,
  caseId: string | null = null,
): ContinuityGraph | undefined {
  const key = scopeKey(caregiverId, caseId);
  const id = scopeIndex.get(key);
  return id ? graphs.get(id) : undefined;
}

export function addToContinuityGraph(
  graph: ContinuityGraph,
  nodes: ContinuityNode[],
  edges: ContinuityEdge[],
): ContinuityGraph {
  const updated: ContinuityGraph = {
    ...graph,
    nodes: [...nodes, ...graph.nodes],
    edges: [...edges, ...graph.edges],
    updated_at: new Date().toISOString(),
  };
  graphs.set(updated.graph_id, updated);
  return updated;
}

export function detectCascadeChains(graph: ContinuityGraph): CascadeChain[] {
  const chains: CascadeChain[] = [];
  const adjacency = new Map<string, { to: string; edgeId: string; type: string }[]>();

  for (const edge of graph.edges) {
    const list = adjacency.get(edge.from_node_id) ?? [];
    list.push({ to: edge.to_node_id, edgeId: edge.id, type: edge.edge_type });
    adjacency.set(edge.from_node_id, list);
  }

  const causalTypes = new Set(["causes", "triggers", "depends_on", "blocks", "follows"]);

  for (const start of graph.nodes.slice(0, 30)) {
    const visited = new Set<string>();
    const path: string[] = [start.id];
    const edgePath: string[] = [];
    let current = start.id;

    for (let depth = 0; depth < 5; depth++) {
      const nexts = (adjacency.get(current) ?? []).filter((n) => causalTypes.has(n.type));
      if (nexts.length === 0) break;
      const next = nexts[0]!;
      if (visited.has(next.to)) break;
      visited.add(next.to);
      path.push(next.to);
      edgePath.push(next.edgeId);
      current = next.to;
    }

    if (path.length >= 3) {
      const labels = path
        .map((id) => graph.nodes.find((n) => n.id === id)?.label)
        .filter(Boolean)
        .join(" → ");

      chains.push({
        chain_id: `chain_${start.id}`,
        node_ids: path,
        edge_ids: edgePath,
        summary: `This sequence shows a cascading continuity chain: ${labels}.`,
        domain: start.domain,
      });
    }
  }

  const seen = new Set<string>();
  return chains.filter((c) => {
    const key = c.node_ids.join(":");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 5);
}

export function resetContinuityGraphStore(): void {
  graphs.clear();
  scopeIndex.clear();
}
