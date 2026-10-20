import type { BehaviorProfile } from "../input-classification";
import type { ModuleWeights } from "../settings-governance/types";
import type { TimeEngineWeightEnvelope } from "./types";

function clamp(value: number, min = 0, max = 2): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Map temporal priority into weight envelope for downstream Priority Engine.
 * Does not schedule or escalate medical urgency.
 */
export function computeTimeEngineWeightEnvelope(params: {
  decayAdjustedUrgency: number;
  dependencyBoost: number;
  activeHorizon: string;
}): TimeEngineWeightEnvelope {
  const { decayAdjustedUrgency, dependencyBoost, activeHorizon } = params;

  const temporalUrgency =
    activeHorizon === "UNSCHEDULED"
      ? 0
      : Math.min(1, decayAdjustedUrgency + dependencyBoost * 0.5);

  let horizonCompression = 1;
  if (activeHorizon === "NOW") horizonCompression = 1.25;
  else if (activeHorizon === "TODAY") horizonCompression = 1.1;
  else if (activeHorizon === "SOON") horizonCompression = 1;
  else if (activeHorizon === "LATER") horizonCompression = 0.85;
  else horizonCompression = 1;

  return {
    temporalUrgency,
    horizonCompression,
    dependencyBoost,
  };
}

/**
 * Soft behavior weighting from temporal envelope — pre-priority only.
 */
export function applyTimeEngineBehaviorWeighting(
  profile: BehaviorProfile,
  envelope: TimeEngineWeightEnvelope,
): BehaviorProfile {
  let prioritization = profile.prioritization_aggressiveness;
  if (envelope.temporalUrgency >= 0.75) {
    prioritization = "elevated";
  } else if (envelope.temporalUrgency === 0 && prioritization === "elevated") {
    // Missing time must not invent elevated priority from time alone.
    prioritization = profile.prioritization_aggressiveness;
  }

  return {
    ...profile,
    verbosity_factor: clamp(profile.verbosity_factor / envelope.horizonCompression, 0.6, 1.2),
    prioritization_aggressiveness: prioritization,
  };
}

/**
 * Merge time engine envelope into governance module weights (time / priority slots).
 */
export function mergeTimeEngineWithModuleWeights(
  weights: ModuleWeights,
  envelope: TimeEngineWeightEnvelope,
): ModuleWeights {
  const timeFactor =
    envelope.temporalUrgency === 0
      ? 0.9
      : 1 + envelope.temporalUrgency * 0.35 * envelope.horizonCompression;

  return {
    memory: weights.memory,
    emotional: weights.emotional,
    time: clamp(weights.time * timeFactor),
    priority: clamp(weights.priority * (1 + envelope.dependencyBoost * 0.2 + envelope.temporalUrgency * 0.15)),
    safety: weights.safety,
    notification: weights.notification,
  };
}
