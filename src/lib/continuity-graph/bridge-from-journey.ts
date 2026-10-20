import type { CareJourneyGraph, JourneyGraphEvent } from "../care-journey-graph/types";
import { getGraphForCaregiver } from "../care-journey-graph/graph-store";
import {
  constraintFromText,
  domainFromCategory,
  inferDomainFromText,
  nodeTypeFromJourneyEvent,
  obligationFromText,
} from "./classify-nodes";
import {
  addToContinuityGraph,
  createEdgeId,
  createNodeId,
  getOrCreateContinuityGraph,
} from "./graph-store";
import { inferUniversalEdges } from "./infer-edges";
import type { ContinuityEdge, ContinuityGraph, ContinuityNode } from "./types";

function eventToNode(event: JourneyGraphEvent, graphId: string): ContinuityNode {
  let nodeType = nodeTypeFromJourneyEvent(event.event_type);
  if (obligationFromText(event.description)) nodeType = "Obligation";
  if (constraintFromText(event.description)) nodeType = "Constraint";
  if (event.event_type === "legal_document") nodeType = "Document";

  const inferred = inferDomainFromText(event.description);
  const domain =
    inferred !== "mixed"
      ? inferred
      : domainFromCategory(event.category) !== "mixed"
        ? domainFromCategory(event.category)
        : "mixed";

  return {
    id: createNodeId(),
    graph_id: graphId,
    node_type: nodeType,
    label: event.title || event.description.slice(0, 120),
    timestamp: event.timestamp,
    domain,
    structured_data: {
      event_type: event.event_type,
      description: event.description,
      people_involved: event.people_involved,
      location: event.location,
      category: event.category,
    },
    source_event_id: event.id,
    source_document_id: null,
    confidence_level:
      event.clinical_importance === "high"
        ? "high"
        : event.clinical_importance === "low" || event.clinical_importance === "informational"
          ? "low"
          : "medium",
    resolved_status: event.resolved_status,
    created_at: event.created_at,
  };
}

/** Rebuild universal graph nodes/edges from the care journey graph (domain bridge). */
export function syncContinuityGraphFromJourney(
  journeyGraph: CareJourneyGraph,
): {
  graph: ContinuityGraph;
  new_nodes: ContinuityNode[];
  new_edges: ContinuityEdge[];
} {
  const graph = getOrCreateContinuityGraph(journeyGraph.caregiver_id, journeyGraph.case_id);
  const existingEventIds = new Set(
    graph.nodes.map((n) => n.source_event_id).filter(Boolean) as string[],
  );

  const newNodes: ContinuityNode[] = [];
  const eventIdToNodeId = new Map<string, string>();

  for (const node of graph.nodes) {
    if (node.source_event_id) eventIdToNodeId.set(node.source_event_id, node.id);
  }

  for (const event of journeyGraph.events) {
    if (existingEventIds.has(event.id)) continue;
    const node = eventToNode(event, graph.graph_id);
    newNodes.push(node);
    eventIdToNodeId.set(event.id, node.id);
  }

  const inferred = inferUniversalEdges(
    [...graph.nodes, ...newNodes],
    journeyGraph.events,
    journeyGraph.relationships,
    eventIdToNodeId,
  );

  const newEdges: ContinuityEdge[] = inferred.map((e) => ({
    id: createEdgeId(),
    graph_id: graph.graph_id,
    from_node_id: e.from_node_id,
    to_node_id: e.to_node_id,
    edge_type: e.edge_type,
    note: e.note,
    confidence_level: e.confidence_level,
    created_at: new Date().toISOString(),
  }));

  const updated = addToContinuityGraph(graph, newNodes, newEdges);
  return { graph: updated, new_nodes: newNodes, new_edges: newEdges };
}

export function getContinuityGraphForCaregiver(
  caregiverId: string,
  caseId: string | null = null,
): ContinuityGraph {
  const journey = getGraphForCaregiver(caregiverId, caseId);
  if (!journey) {
    return getOrCreateContinuityGraph(caregiverId, caseId);
  }
  return syncContinuityGraphFromJourney(journey).graph;
}
