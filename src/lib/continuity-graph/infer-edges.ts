import type { JourneyGraphEvent, JourneyRelationship, RelationshipType } from "../care-journey-graph/types";
import type { UniversalEdgeType } from "./types";

const JOURNEY_TO_UNIVERSAL: Record<RelationshipType, UniversalEdgeType> = {
  caused: "causes",
  resulted_in: "follows",
  followed_by: "precedes",
  related_to: "relates_to",
  continued_from: "modifies",
  changed_due_to: "modifies",
  recommended: "triggers",
};

export function mapJourneyRelationshipType(type: RelationshipType): UniversalEdgeType {
  return JOURNEY_TO_UNIVERSAL[type] ?? "relates_to";
}

/** Infer additional universal edges from event content and temporal order. */
export function inferUniversalEdges(
  nodes: { id: string; source_event_id: string | null; timestamp: string | null; node_type: string }[],
  journeyEvents: JourneyGraphEvent[],
  existingJourneyRels: JourneyRelationship[],
  eventIdToNodeId: Map<string, string>,
): {
  from_node_id: string;
  to_node_id: string;
  edge_type: UniversalEdgeType;
  note: string;
  confidence_level: "high" | "medium" | "low";
}[] {
  const edges: {
    from_node_id: string;
    to_node_id: string;
    edge_type: UniversalEdgeType;
    note: string;
    confidence_level: "high" | "medium" | "low";
  }[] = [];

  for (const rel of existingJourneyRels) {
    const fromNode = eventIdToNodeId.get(rel.from_event_id);
    const toNode = eventIdToNodeId.get(rel.to_event_id);
    if (!fromNode || !toNode) continue;
    edges.push({
      from_node_id: fromNode,
      to_node_id: toNode,
      edge_type: mapJourneyRelationshipType(rel.relationship_type),
      note: rel.note,
      confidence_level: "medium",
    });
  }

  const sorted = [...journeyEvents].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const curr = sorted[i]!;
    const prevNode = eventIdToNodeId.get(prev.id);
    const currNode = eventIdToNodeId.get(curr.id);
    if (!prevNode || !currNode) continue;

    const days =
      (new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime()) /
      (1000 * 60 * 60 * 24);

    if (days <= 14) {
      edges.push({
        from_node_id: prevNode,
        to_node_id: currNode,
        edge_type: "precedes",
        note: "Temporal sequence in continuity graph.",
        confidence_level: days <= 7 ? "high" : "medium",
      });
    }

    if (prev.event_type === "fall" && ["emergency_visit", "hospital_visit"].includes(curr.event_type)) {
      edges.push({
        from_node_id: prevNode,
        to_node_id: currNode,
        edge_type: "causes",
        note: "Fall may precede hospital or emergency event.",
        confidence_level: "medium",
      });
    }

    if (prev.event_type === "legal_document" && curr.event_type === "decision") {
      edges.push({
        from_node_id: prevNode,
        to_node_id: currNode,
        edge_type: "triggers",
        note: "Legal document may trigger subsequent decision.",
        confidence_level: "medium",
      });
    }

    if (prev.event_type === "insurance_update" && curr.event_type === "administrative") {
      edges.push({
        from_node_id: prevNode,
        to_node_id: currNode,
        edge_type: "depends_on",
        note: "Administrative action may depend on insurance status.",
        confidence_level: "low",
      });
    }

    if (
      ["medication_started", "medication_stopped"].includes(prev.event_type) &&
      ["symptom", "behaviour_change"].includes(curr.event_type)
    ) {
      edges.push({
        from_node_id: prevNode,
        to_node_id: currNode,
        edge_type: "modifies",
        note: "Condition observation may relate to prior action.",
        confidence_level: "low",
      });
    }
  }

  const seen = new Set<string>();
  return edges.filter((e) => {
    const key = `${e.from_node_id}:${e.to_node_id}:${e.edge_type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
