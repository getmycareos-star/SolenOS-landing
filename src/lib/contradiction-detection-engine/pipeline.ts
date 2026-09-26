import {
  CONTRADICTION_DETECTION_DEFINING_PRINCIPLE,
  CONTRADICTION_DETECTION_RULES,
} from "./contract-constants";
import { detectMobilityTransitions, mergeTimelineContradictions } from "./detect";
import {
  detectGeneralContradictions,
  detectWithinMessageContradictions,
} from "./general";
import type { ContradictionDetectionResult, ProcessContradictionDetectionInput } from "./types";

export function processContradictionDetection(
  input: ProcessContradictionDetectionInput,
): ContradictionDetectionResult {
  const asOf = input.as_of ?? new Date().toISOString();
  const mobility = detectMobilityTransitions(input.events, asOf);
  const timelineContradictions = mergeTimelineContradictions(
    input.care_timeline?.care_record.conflicts ?? [],
  );
  // General detection: medication actions and doses, measurements, function level,
  // intake — across events and across people, not just mobility.
  const general = detectGeneralContradictions([...input.events, ...input.events_created]);
  const latestMessage = [...input.events_created]
    .map((e) => e.raw_input ?? "")
    .filter(Boolean)
    .join(" ");
  const withinMessage = latestMessage ? detectWithinMessageContradictions(latestMessage) : [];

  const open_contradictions = [
    ...mobility.open_contradictions,
    ...timelineContradictions,
    ...general.contradictions,
    ...withinMessage,
  ].filter(
    (c, index, all) =>
      all.findIndex(
        (other) =>
          other.contradiction_id === c.contradiction_id ||
          (other.field === c.field && other.shared_message === c.shared_message),
      ) === index,
  );

  const clarification_triggers = [
    ...mobility.clarification_triggers,
    ...general.clarification_triggers,
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
    claims_examined: general.claims_examined,
  };
}
