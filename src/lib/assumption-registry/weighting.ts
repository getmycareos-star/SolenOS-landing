import type { BehaviorProfile } from "../input-classification";
import type { GovernanceApplicationResult } from "../settings-governance/types";
import type { AssumptionInfluenceEnvelope } from "./types";

export function applyAssumptionBehaviorWeighting(
  behaviorProfile: BehaviorProfile,
  envelope: AssumptionInfluenceEnvelope,
): BehaviorProfile {
  if (envelope.compositeBias <= 0) return behaviorProfile;

  const dampen = envelope.staleInfluenceCount > 0 ? 0.92 : 1;
  const factor = 1 - envelope.compositeBias * 0.15 * dampen;

  return {
    ...behaviorProfile,
    verbosity_factor: Math.max(0.5, behaviorProfile.verbosity_factor * factor),
    uncertainty_strictness:
      envelope.compositeBias > 0.35 ? "strict" : behaviorProfile.uncertainty_strictness,
  };
}

export function mergeAssumptionWithModuleWeights(
  moduleWeights: GovernanceApplicationResult["moduleWeights"],
  envelope: AssumptionInfluenceEnvelope,
): GovernanceApplicationResult["moduleWeights"] {
  if (envelope.compositeBias <= 0) return moduleWeights;

  const stalePenalty = envelope.staleInfluenceCount > 0 ? 0.9 : 1;
  const boost = 1 + envelope.compositeBias * stalePenalty;

  return {
    ...moduleWeights,
    priority: Math.min(2, moduleWeights.priority * boost),
    safety: Math.min(2, moduleWeights.safety * (1 + envelope.compositeBias * 0.05)),
  };
}
