import type { BehaviorProfile } from "../input-classification";
import type { GovernanceApplicationResult } from "../settings-governance/types";
import type { MissingInformationInfluenceEnvelope } from "./types";

export function applyMissingInformationBehaviorWeighting(
  behaviorProfile: BehaviorProfile,
  envelope: MissingInformationInfluenceEnvelope,
): BehaviorProfile {
  if (envelope.highPriorityOpenCount <= 0 && envelope.openCount <= 0) {
    return behaviorProfile;
  }

  return {
    ...behaviorProfile,
    uncertainty_strictness:
      envelope.highPriorityOpenCount > 0
        ? "strict"
        : behaviorProfile.uncertainty_strictness,
    verbosity_factor: Math.max(
      0.5,
      behaviorProfile.verbosity_factor * (1 - envelope.confidencePenalty * 0.1),
    ),
  };
}

export function mergeMissingInformationWithModuleWeights(
  moduleWeights: GovernanceApplicationResult["moduleWeights"],
  envelope: MissingInformationInfluenceEnvelope,
): GovernanceApplicationResult["moduleWeights"] {
  if (envelope.highPriorityOpenCount <= 0) return moduleWeights;

  return {
    ...moduleWeights,
    safety: Math.min(2, moduleWeights.safety * (1 + envelope.uncertaintyBoost * 0.2)),
    priority: Math.max(
      0.3,
      moduleWeights.priority * (1 - envelope.confidencePenalty * 0.15),
    ),
  };
}
