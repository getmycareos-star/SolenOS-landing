import type { CaregiverLoadInputs } from "../caregiver-load-index/types";
import type { InteractionLoadCliBoost, InteractionLoadSignalResult } from "./types";

export function buildInteractionLoadCliBoost(
  layer: InteractionLoadSignalResult,
): InteractionLoadCliBoost {
  if (!layer.detected) {
    return { cognitiveLoadBoost: 0, conflictLoadBoost: 0, coordinationLoadBoost: 0 };
  }
  return {
    cognitiveLoadBoost: layer.metrics.cognitiveLoadBoost,
    conflictLoadBoost: layer.metrics.conflictLoadBoost,
    coordinationLoadBoost: layer.metrics.coordinationLoadBoost,
  };
}

/**
 * Feed cognitive load and boundary stress into CLI inputs.
 */
export function applyInteractionLoadToCliInputs(
  inputs: CaregiverLoadInputs,
  layer: InteractionLoadSignalResult,
): CaregiverLoadInputs {
  if (!layer.detected) return inputs;
  const boost = buildInteractionLoadCliBoost(layer);
  return {
    ...inputs,
    conflictLoad: Math.min(100, inputs.conflictLoad + boost.conflictLoadBoost),
    coordinationLoad: Math.min(100, inputs.coordinationLoad + boost.coordinationLoadBoost),
    prolongedUnresolvedBoost:
      (inputs.prolongedUnresolvedBoost ?? 0) + boost.cognitiveLoadBoost * 0.08,
  };
}
