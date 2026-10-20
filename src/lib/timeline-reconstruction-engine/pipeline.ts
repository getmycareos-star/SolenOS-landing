import {
  TIMELINE_RECONSTRUCTION_DEFINING_PRINCIPLE,
  TIMELINE_RECONSTRUCTION_RULES,
} from "./contract-constants";
import {
  attachEventsToNodes,
  buildClinicalClarificationTriggers,
  detectOrderingConflicts,
  extractTemporalSegments,
  reorderNodesChronologically,
} from "./reconstruct";
import type { ProcessTimelineReconstructionInput, TimelineReconstructionResult } from "./types";

export function processTimelineReconstruction(
  input: ProcessTimelineReconstructionInput,
): TimelineReconstructionResult {
  const asOf = input.as_of ?? new Date().toISOString();
  const rawSegments = extractTemporalSegments(input.raw_input, asOf);
  const correctionCount = rawSegments.filter((n) => n.source_channel === "inferred_correction").length;

  let nodes = reorderNodesChronologically(rawSegments);
  nodes = attachEventsToNodes(nodes, input.events_created.length > 0 ? input.events_created : input.events);

  const ordering_conflicts = detectOrderingConflicts(nodes);
  const clarification_triggers = buildClinicalClarificationTriggers(nodes, ordering_conflicts);

  const uncertainty_flags = nodes
    .filter((n) => n.ordering_label !== "exact")
    .map(
      (n) =>
        `${n.observation.slice(0, 60)}… (${n.ordering_label}, confidence ${Math.round(n.temporal_confidence * 100)}%)`,
    );

  return {
    active: nodes.length > 0 || input.events.length > 0,
    nodes,
    ordering_conflicts,
    correction_segments_detected: correctionCount,
    uncertainty_flags,
    clarification_triggers,
    multi_hypothesis: ordering_conflicts.length > 0 || uncertainty_flags.length > 1,
    rules_upheld: [...TIMELINE_RECONSTRUCTION_RULES],
    defining_principle: TIMELINE_RECONSTRUCTION_DEFINING_PRINCIPLE,
  };
}
