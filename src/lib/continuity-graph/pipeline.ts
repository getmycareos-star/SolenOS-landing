import type { CareJourneyPipelineResult } from "../care-journey-graph/types";
import { getGraphForCaregiver } from "../care-journey-graph";
import { processCareJourneyInput } from "../care-journey-graph/server";
import { syncContinuityGraphFromJourney } from "./bridge-from-journey";
import { runContextReasoning } from "./context-reasoning";
import { runContinuityIntelligence } from "./continuity-intelligence";
import { detectCascadeChains } from "./graph-store";
import type {
  ContinuityGraphResult,
  IngestContinuityInputParams,
} from "./types";

/**
 * Universal Continuity Graph pipeline.
 *
 * Input → Journey ingest (bridge) → Universal nodes/edges →
 * Continuity intelligence → Context reasoning
 */
export function processContinuityInput(
  input: IngestContinuityInputParams,
): ContinuityGraphResult {
  const caregiverId = input.caregiver_id ?? "default_caregiver";
  const caseId = input.case_id ?? null;

  processCareJourneyInput({
    description: input.description,
    caregiver_id: caregiverId,
    case_id: caseId,
    source: input.source,
    timestamp: input.timestamp,
    metadata: input.metadata,
  });

  const journeyGraph = getGraphForCaregiver(caregiverId, caseId)!;
  const { graph, new_nodes, new_edges } = syncContinuityGraphFromJourney(journeyGraph);

  const context_reasoning = runContextReasoning(input.description);
  const cascade_chains = detectCascadeChains(graph);
  runContinuityIntelligence(graph);

  return {
    graph,
    new_nodes,
    new_edges,
    cascade_chains,
    context_reasoning,
  };
}

/** Sync universal graph after an existing journey pipeline result. */
export function syncFromJourneyResult(
  journeyResult: CareJourneyPipelineResult,
): ContinuityGraphResult {
  const { graph, new_nodes, new_edges } = syncContinuityGraphFromJourney(journeyResult.graph);
  const context_reasoning = runContextReasoning(journeyResult.event.description);
  const cascade_chains = detectCascadeChains(graph);
  runContinuityIntelligence(graph);

  return {
    graph,
    new_nodes,
    new_edges,
    cascade_chains,
    context_reasoning,
  };
}

export function getContinuityGraphSnapshot(
  caregiverId: string,
  caseId: string | null = null,
): ContinuityGraphResult | null {
  const journeyGraph = getGraphForCaregiver(caregiverId, caseId);
  if (!journeyGraph || journeyGraph.events.length === 0) return null;

  const { graph, new_nodes, new_edges } = syncContinuityGraphFromJourney(journeyGraph);
  return {
    graph,
    new_nodes,
    new_edges,
    cascade_chains: detectCascadeChains(graph),
    context_reasoning: {
      known: [],
      unknown: [],
      confidence: "insufficient",
      questions: [],
      completeness_score: 0,
    },
  };
}
