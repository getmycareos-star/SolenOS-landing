import type { CareJourneyGraphLayerPayload, CareJourneyPipelineResult } from "./types";
import { CARE_JOURNEY_GRAPH_BOUNDARY, CARE_JOURNEY_GRAPH_IDENTITY } from "./types";

export function toCareJourneyGraphLayerPayload(
  result: CareJourneyPipelineResult,
): CareJourneyGraphLayerPayload {
  return {
    identity: CARE_JOURNEY_GRAPH_IDENTITY,
    boundary: CARE_JOURNEY_GRAPH_BOUNDARY,
    journey_id: result.graph.journey_id,
    event_id: result.event.id,
    event_type: result.event.event_type,
    completeness_status: result.completeness_status,
    facts_only_summary: result.facts_only_summary,
    reasoning_ready: result.reasoning_ready,
    new_relationships: result.new_relationships,
    continuity: result.continuity,
    recent_event_count: result.graph.events.length,
  };
}
