import type { BehaviorProfile } from "../input-classification";
import type { ModuleWeights } from "../settings-governance/types";
import type { PriorityEngineWeightEnvelope } from "./types";

function clamp(value: number, min = 0, max = 2): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Soft behavior weighting from priority envelope — pre-Action Generator only.
 * Does not generate actions or interpret meaning.
 */
export function applyPriorityBehaviorWeightingFromEnvelope(
  profile: BehaviorProfile,
  envelope: PriorityEngineWeightEnvelope,
): BehaviorProfile {
  let prioritization = profile.prioritization_aggressiveness;
  if (envelope.topScore >= 0.75) {
    prioritization = "elevated";
  } else if (envelope.topScore < 0.25 && prioritization === "elevated") {
    prioritization = "standard";
  }

  let verbosity = profile.verbosity_factor;
  if (envelope.conflictCount > 0) {
    // Conflicts flagged for resolver — keep output compressed.
    verbosity = clamp(verbosity * 0.92, 0.55, 1.15);
  }

  return {
    ...profile,
    prioritization_aggressiveness: prioritization,
    verbosity_factor: verbosity,
  };
}

/**
 * Merge priority envelope into governance module weights (priority slot).
 */
export function mergePriorityWithModuleWeights(
  weights: ModuleWeights,
  envelope: PriorityEngineWeightEnvelope,
): ModuleWeights {
  const priorityFactor =
    envelope.passedCount === 0
      ? 0.9
      : 1 + envelope.topScore * 0.25 + envelope.meanConfidence * 0.1;

  return {
    ...weights,
    priority: clamp(weights.priority * priorityFactor),
    safety: envelope.riskPenaltyApplied
      ? clamp(weights.safety * (1 + (1 - envelope.topScore) * 0.05))
      : weights.safety,
  };
}
