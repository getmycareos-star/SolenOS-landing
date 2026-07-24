import { getGraphForCaregiver } from "../care-journey-graph/graph-store";
import { parseMemoryQuery } from "./parse-query";
import {
  aggregateRelevantEvents,
  currentStateFromEvents,
  detectContinuityGaps,
  expandCausalChain,
  findCorrelatedEvents,
} from "./temporal-aggregator";
import {
  buildContinuityInsight,
  buildReconstructedMemory,
  buildTimelineSummary,
  computeConfidence,
  detectTrend,
} from "./pattern-recognition";
import type {
  MemoryReconstructionResult,
  ReconstructMemoryParams,
} from "./types";

/**
 * Memory Reconstruction Engine — temporal aggregation over Care Journey events.
 * NOT search. NOT document retrieval. NOT chatbot Q&A.
 */
export function reconstructMemory(params: ReconstructMemoryParams): MemoryReconstructionResult {
  const caregiverId = params.caregiver_id ?? "default_caregiver";
  const parsed = parseMemoryQuery(params.query);
  const graph = getGraphForCaregiver(caregiverId, params.case_id ?? null);
  const allEvents = graph?.events ?? [];
  const relationships = graph?.relationships ?? [];

  const relevant = aggregateRelevantEvents(allEvents, parsed);
  const { events: scopedEvents, chainNotes } =
    parsed.reconstruction_type === "causality"
      ? expandCausalChain(relevant, allEvents, relationships)
      : { events: relevant, chainNotes: [] as string[] };

  const conceptLabel =
    parsed.concepts.map((c) => c.label).join(" / ") || "Care journey topic";
  const trend = detectTrend(scopedEvents);
  const gaps = detectContinuityGaps(scopedEvents);

  const reconstructed_memory = buildReconstructedMemory({
    events: scopedEvents,
    conceptLabel,
    trend,
    reconstructionType: parsed.reconstruction_type,
  });

  const timeline_summary = buildTimelineSummary(scopedEvents);
  const correlated_events = findCorrelatedEvents(scopedEvents, allEvents, relationships);
  const current_state = currentStateFromEvents(scopedEvents);

  let continuity_insight = buildContinuityInsight({
    conceptLabel,
    events: scopedEvents,
    trend,
    reconstructionType: parsed.reconstruction_type,
    causalChain: chainNotes,
    gaps,
  });

  if (correlated_events.length > 0) {
    continuity_insight += ` Correlated events: ${correlated_events.join("; ")}.`;
  }
  if (current_state) {
    continuity_insight += ` Current state: ${current_state}.`;
  }

  const confidence = computeConfidence(
    scopedEvents.length,
    parsed.concepts.length > 0,
  );

  return {
    query: params.query,
    reconstructed_memory,
    timeline_summary,
    continuity_insight,
    confidence,
    reconstruction_type: parsed.reconstruction_type,
    events_analyzed: scopedEvents.length,
    causal_chain: chainNotes,
    continuity_gaps: gaps,
    correlated_events,
    current_state,
  };
}
