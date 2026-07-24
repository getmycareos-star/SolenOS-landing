import type { BehaviorProfile } from "../input-classification";
import type { GovernanceApplicationResult } from "../settings-governance/types";
import type {
  OverloadSimplificationSignals,
  SystemRiskPriorityEnvelope,
  SystemRiskState,
} from "./types";

/**
 * Soft behavior weighting from systemic risk / overload — never invents actions.
 */
export function applySituationRiskBehaviorWeighting(
  behaviorProfile: BehaviorProfile,
  params: {
    systemRisk: SystemRiskState;
    overload: OverloadSimplificationSignals;
  },
): BehaviorProfile {
  const { systemRisk, overload } = params;
  if (systemRisk.totalRiskExposure <= 0 && !overload.overloadHigh) {
    return behaviorProfile;
  }

  let verbosity = behaviorProfile.verbosity_factor;
  let uncertainty = behaviorProfile.uncertainty_strictness;
  let prioritization = behaviorProfile.prioritization_aggressiveness;

  if (overload.overloadHigh || overload.reduceCognitiveComplexity) {
    verbosity = Math.min(verbosity, 0.65);
    uncertainty = "strict";
    // Overload forces focus on top burdens — elevated prioritization, compressed output.
    prioritization = "elevated";
  } else if (systemRisk.totalRiskExposure >= 50) {
    verbosity = Math.min(verbosity, 0.85);
  }

  return {
    ...behaviorProfile,
    verbosity_factor: verbosity,
    uncertainty_strictness: uncertainty,
    prioritization_aggressiveness: prioritization,
  };
}

export function mergeSituationRiskWithModuleWeights(
  moduleWeights: GovernanceApplicationResult["moduleWeights"],
  envelope: SystemRiskPriorityEnvelope,
  overload: OverloadSimplificationSignals,
): GovernanceApplicationResult["moduleWeights"] {
  const exposureBoost = 1 + envelope.systemRiskExposureWeight * 0.35;
  const safetyBoost = overload.reduceAutonomy ? 1.35 : 1 + envelope.assumptionUncertainty * 0.2;

  return {
    ...moduleWeights,
    priority: Math.min(2, moduleWeights.priority * exposureBoost),
    safety: Math.min(2, moduleWeights.safety * safetyBoost),
    emotional: overload.reduceCognitiveComplexity
      ? Math.min(2, moduleWeights.emotional * 1.2)
      : moduleWeights.emotional,
  };
}
