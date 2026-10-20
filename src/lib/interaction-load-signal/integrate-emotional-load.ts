import { clamp01 } from "../emotional-load-signal/compute";
import { INTERACTION_LOAD_METRIC_BOOST } from "./contract-constants";
import type { EmotionalLoadSignalInputs } from "../emotional-load-signal/types";
import type { InteractionLoadSignalResult } from "./types";

/**
 * Feed emotional load boost and sleep disruption into Emotional Load Signal inputs.
 */
export function applyInteractionLoadToEmotionalInputs(
  inputs: EmotionalLoadSignalInputs,
  layer: InteractionLoadSignalResult,
): EmotionalLoadSignalInputs {
  if (!layer.detected) return inputs;

  const { metrics, sleepProtectionMode, detectedSignals } = layer;
  let depletionBoost = 0;
  if (metrics.sleepDisruptionRisk === "CRITICAL") {
    depletionBoost += INTERACTION_LOAD_METRIC_BOOST.depletionPerSleepCritical;
  } else if (metrics.sleepDisruptionRisk === "ELEVATED") {
    depletionBoost += INTERACTION_LOAD_METRIC_BOOST.depletionPerSleepCritical * 0.5;
  }
  if (detectedSignals.alwaysOnCall >= 0.35) {
    depletionBoost += INTERACTION_LOAD_METRIC_BOOST.depletionPerAlwaysOn;
  }

  const emotionalBiasBoost =
    (metrics.emotionalLoadBoost / 100) *
      INTERACTION_LOAD_METRIC_BOOST.emotionalBiasPerExhaustion +
    (sleepProtectionMode.engaged ? 0.08 : 0);

  return {
    ...inputs,
    uncertaintyLoad: Math.min(
      100,
      inputs.uncertaintyLoad + metrics.cognitiveLoadBoost * 0.15,
    ),
    conflictLoad: Math.min(
      100,
      inputs.conflictLoad + metrics.conflictLoadBoost,
    ),
    depletionFactor: clamp01(inputs.depletionFactor + depletionBoost),
    emotionalBias: clamp01(inputs.emotionalBias + emotionalBiasBoost),
  };
}
