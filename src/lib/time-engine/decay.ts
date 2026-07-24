import { URGENCY_DECAY_LAMBDA } from "./contract-constants";
import { defaultUrgencyDecayFunction } from "./defaults";
import type { UrgencyDecayFunction } from "./types";

/**
 * urgencyDecay(timeDelta) = Math.exp(-λ * timeDelta)
 * Urgency decays unless reinforced by memory, emotional signals, or dependencies.
 */
export function computeUrgencyDecay(
  timeDeltaHours: number,
  lambda: number = URGENCY_DECAY_LAMBDA,
  decayFn: UrgencyDecayFunction = defaultUrgencyDecayFunction,
): number {
  return decayFn(timeDeltaHours, lambda);
}

export function applyDecayToUrgency(
  baseUrgency: number,
  timeDeltaHours: number,
  reinforcementFactor: number = 1,
  lambda: number = URGENCY_DECAY_LAMBDA,
  decayFn: UrgencyDecayFunction = defaultUrgencyDecayFunction,
): number {
  const decay = computeUrgencyDecay(timeDeltaHours, lambda, decayFn);
  return Math.min(1, Math.max(0, baseUrgency * decay * reinforcementFactor));
}
