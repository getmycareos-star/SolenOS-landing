import { clamp01 } from "../emotional-load-signal/compute";
import { LOAD_EMOTIONAL_BOOST } from "./contract-constants";
import type { EmotionalLoadSignalInputs } from "../emotional-load-signal/types";
import type { LoadInterpretation, LoadInterpretationBoost } from "./types";

export function buildLoadInterpretationBoost(
  interpretation: LoadInterpretation,
): LoadInterpretationBoost {
  if (!interpretation.loadFirstMode) {
    return {
      uncertaintyLoadBoost: 0,
      conflictLoadBoost: 0,
      depletionFactorBoost: 0,
      emotionalBiasBoost: 0,
    };
  }

  return {
    uncertaintyLoadBoost:
      interpretation.uncertaintyIndex * LOAD_EMOTIONAL_BOOST.uncertaintyLoadPerIndex,
    conflictLoadBoost:
      interpretation.emotionalLoadScore >= 35
        ? LOAD_EMOTIONAL_BOOST.conflictLoadPerEmotional
        : 0,
    depletionFactorBoost:
      interpretation.sleepRisk * LOAD_EMOTIONAL_BOOST.depletionPerSleepRisk +
      interpretation.burnoutProbability * LOAD_EMOTIONAL_BOOST.depletionPerBurnout,
    emotionalBiasBoost:
      (interpretation.emotionalLoadScore / 100) *
      LOAD_EMOTIONAL_BOOST.emotionalBiasPerEmotional,
  };
}

/**
 * Feed sleepRisk and uncertaintyIndex into Emotional Load Signal inputs.
 */
export function applyLoadInterpretationToEmotionalInputs(
  inputs: EmotionalLoadSignalInputs,
  interpretation: LoadInterpretation,
): EmotionalLoadSignalInputs {
  const boost = buildLoadInterpretationBoost(interpretation);
  if (!interpretation.loadFirstMode && interpretation.emotionalLoadScore < 20) {
    return inputs;
  }

  return {
    ...inputs,
    uncertaintyLoad: Math.min(
      100,
      inputs.uncertaintyLoad +
        boost.uncertaintyLoadBoost +
        interpretation.uncertaintyIndex * 20,
    ),
    conflictLoad: Math.min(
      100,
      inputs.conflictLoad +
        boost.conflictLoadBoost +
        interpretation.emotionalLoadScore * 0.12,
    ),
    depletionFactor: clamp01(
      inputs.depletionFactor +
        boost.depletionFactorBoost +
        interpretation.sleepRisk * 0.2,
    ),
    emotionalBias: clamp01(
      inputs.emotionalBias + boost.emotionalBiasBoost + interpretation.sleepRisk * 0.08,
    ),
  };
}
