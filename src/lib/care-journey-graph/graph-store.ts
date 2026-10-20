import type { CareJourneyGraph, JourneyGraphEvent, JourneyRelationship } from "./types";

const graphs = new Map<string, CareJourneyGraph>();
const caregiverIndex = new Map<string, string>();

function journeyKey(caregiverId: string, caseId: string | null): string {
  return `${caregiverId}::${caseId ?? "default"}`;
}

export function createJourneyId(): string {
  return `cjg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createGraphEventId(): string {
  return `jge_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function getOrCreateGraph(caregiverId: string, caseId: string | null): CareJourneyGraph {
  const key = journeyKey(caregiverId, caseId);
  const existingId = caregiverIndex.get(key);
  if (existingId) {
    const graph = graphs.get(existingId);
    if (graph) return graph;
  }

  const now = new Date().toISOString();
  const graph: CareJourneyGraph = {
    journey_id: createJourneyId(),
    caregiver_id: caregiverId,
    case_id: caseId,
    events: [],
    relationships: [],
    updated_at: now,
  };
  graphs.set(graph.journey_id, graph);
  caregiverIndex.set(key, graph.journey_id);
  return graph;
}

export function getGraph(journeyId: string): CareJourneyGraph | undefined {
  return graphs.get(journeyId);
}

export function getGraphForCaregiver(
  caregiverId: string,
  caseId: string | null = null,
): CareJourneyGraph | undefined {
  const key = journeyKey(caregiverId, caseId);
  const id = caregiverIndex.get(key);
  return id ? graphs.get(id) : undefined;
}

export function addEventToGraph(
  graph: CareJourneyGraph,
  event: JourneyGraphEvent,
  relationships: JourneyRelationship[],
): CareJourneyGraph {
  const relatedIds = relationships.map((r) => r.from_event_id);
  const updatedEvent: JourneyGraphEvent = {
    ...event,
    related_event_ids: [...new Set([...event.related_event_ids, ...relatedIds])],
  };

  const updated: CareJourneyGraph = {
    ...graph,
    events: [updatedEvent, ...graph.events],
    relationships: [...relationships, ...graph.relationships],
    updated_at: new Date().toISOString(),
  };
  graphs.set(updated.journey_id, updated);
  return updated;
}

export function resetCareJourneyGraphStore(): void {
  graphs.clear();
  caregiverIndex.clear();
}
