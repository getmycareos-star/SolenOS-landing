import {
  STATE_OF_CARE_DEFINING_PRINCIPLE,
  STATE_OF_CARE_DESIGN_RULES,
} from "./contract-constants";
import { deriveStateOfCareSections, deriveWhatMattersMost } from "./derive-summary";
import { nextSnapshotVersion } from "./store";
import type { ProcessStateOfCareSummaryInput, StateOfCareSummaryResult } from "./types";

export function processStateOfCareSummary(
  input: ProcessStateOfCareSummaryInput,
): StateOfCareSummaryResult {
  const timestamp = input.as_of ?? new Date().toISOString();
  const sections = deriveStateOfCareSections(input);
  const snapshot_version = nextSnapshotVersion(input.context.care_recipient_id);

  const summary = {
    timestamp,
    care_recipient_id: input.context.care_recipient_id,
    snapshot_version,
    sections,
    what_matters_most: deriveWhatMattersMost(sections),
  };

  return {
    active: true,
    summary,
    rules_upheld: [...STATE_OF_CARE_DESIGN_RULES],
    defining_principle: STATE_OF_CARE_DEFINING_PRINCIPLE,
    derived_from: [
      "care_context",
      "care_events",
      "behavior_interpretation_engine",
      "continuity_decay_engine",
      "trust_layer_engine",
      "multi_caregiver_fusion",
      "crisis_mode_interaction_layer",
    ],
  };
}
