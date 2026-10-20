import {
  CONTINUITY_GRAPH_IDENTITY,
  CONTINUITY_GRAPH_MOAT,
  CONTINUITY_GRAPH_THESIS,
} from "./contract-constants";
import type { ContinuityGraphLayerPayload, ContinuityGraphResult } from "./types";
import { runContinuityIntelligence } from "./continuity-intelligence";

export function toContinuityGraphLayerPayload(
  result: ContinuityGraphResult,
): ContinuityGraphLayerPayload {
  const insights = runContinuityIntelligence(result.graph);

  return {
    identity: CONTINUITY_GRAPH_IDENTITY,
    thesis: CONTINUITY_GRAPH_THESIS,
    graph_id: result.graph.graph_id,
    node_count: result.graph.nodes.length,
    edge_count: result.graph.edges.length,
    cascade_chains: result.cascade_chains,
    context_reasoning: result.context_reasoning,
    continuity_insights: insights,
    moat: CONTINUITY_GRAPH_MOAT,
  };
}
