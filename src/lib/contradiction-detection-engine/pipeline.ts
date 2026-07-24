import {
  CONTRADICTION_DETECTION_DEFINING_PRINCIPLE,
  CONTRADICTION_DETECTION_RULES,
} from "./contract-constants";
import { detectMobilityTransitions, mergeTimelineContradictions } from "./detect";
import type { ContradictionDetectionResult, ProcessContradictionDetectionInput } from "./types";

export function processContradictionDetection(
  input: ProcessContradictionDetectionInput,
): ContradictionDetectionResult {
  const asOf = input.as_of ?? new Date().toISOString();
  const mobility = detectMobilityTransitions(input.events, asOf);
  const timelineContradictions = mergeTimelineContradictions(
    input.care_timeline?.care_record.conflicts ?? [],
  );

  const open_contradictions = [...mobility.open_contradictions, ...timelineContradictions];
  const clarification_triggers = [
    ...mobility.clarification_triggers,
    ...open_contradictions
      .filter((c) => c.affects_safety)
      .map((c) => `Clarify sequence for ${c.field}: ${c.shared_message}`),
  ].slice(0, 4);

  return {
    active: true,
    transitions: mobility.transitions,
    open_contradictions,
    clarification_triggers: [...new Set(clarification_triggers)],
    change_classifications: mobility.classifications,
    events_preserved_count: input.events.length,
    rules_upheld: [...CONTRADICTION_DETECTION_RULES],
    defining_principle: CONTRADICTION_DETECTION_DEFINING_PRINCIPLE,
  };
}
