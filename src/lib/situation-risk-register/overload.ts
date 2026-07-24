import {
  OVERLOAD_PRIORITY_TOP_N,
  OVERLOAD_RISK_THRESHOLD,
  SYSTEM_RISK_EXPOSURE_PRIORITY_WEIGHT,
} from "./contract-constants";
import { emptyOverloadSignals, emptyPriorityEnvelope, clamp01 } from "./defaults";
import type {
  OverloadSimplificationSignals,
  SystemRiskPriorityEnvelope,
  SystemRiskState,
} from "./types";
import type { AssumptionInfluenceEnvelope } from "../assumption-registry/types";
import type { MissingInformationInfluenceEnvelope } from "../missing-information-queue/types";

/**
 * if totalRiskExposure > 75 → overloadRisk HIGH
 * Behavior: reduce complexity, prioritize top 1–2, suppress secondary, simplify decisions.
 */
export function detectOverload(
  systemRisk: SystemRiskState,
): OverloadSimplificationSignals {
  const overloadHigh = systemRisk.totalRiskExposure > OVERLOAD_RISK_THRESHOLD;
  if (!overloadHigh) {
    return {
      ...emptyOverloadSignals(),
      overloadHigh: false,
      maxPrioritySituations: 3,
    };
  }

  return {
    overloadHigh: true,
    reduceCognitiveComplexity: true,
    prioritizeTopSituationsOnly: true,
    maxPrioritySituations: OVERLOAD_PRIORITY_TOP_N,
    suppressSecondaryRecommendations: true,
    simplifyDecisionOutputs: true,
    reduceAutonomy: true,
    increaseConfirmation: true,
  };
}

/**
 * Priority Engine global modifier:
 * priorityScore = baseUrgency + systemRiskExposureWeight + missingInfoWeight + assumptionUncertainty
 */
export function buildSystemRiskPriorityEnvelope(params: {
  systemRisk: SystemRiskState;
  overload: OverloadSimplificationSignals;
  missingInformationEnvelope?: MissingInformationInfluenceEnvelope;
  assumptionEnvelope?: AssumptionInfluenceEnvelope;
}): SystemRiskPriorityEnvelope {
  if (
    params.systemRisk.totalRiskExposure <= 0 &&
    !params.missingInformationEnvelope &&
    !params.assumptionEnvelope
  ) {
    return emptyPriorityEnvelope();
  }

  const systemRiskExposureWeight = clamp01(
    (params.systemRisk.totalRiskExposure / 100) * SYSTEM_RISK_EXPOSURE_PRIORITY_WEIGHT +
      params.systemRisk.totalRiskExposure / 100 * (1 - SYSTEM_RISK_EXPOSURE_PRIORITY_WEIGHT) * 0.5,
  );

  const missingInfoWeight = clamp01(
    (params.missingInformationEnvelope?.uncertaintyBoost ?? 0) +
      (params.missingInformationEnvelope?.confidencePenalty ?? 0),
  );

  const assumptionUncertainty = clamp01(
    (params.assumptionEnvelope?.compositeBias ?? 0) +
      Math.min(0.4, (params.assumptionEnvelope?.staleInfluenceCount ?? 0) * 0.08),
  );

  return {
    systemRiskExposureWeight,
    missingInfoWeight,
    assumptionUncertainty,
    overloadCollapseTopN: params.overload.overloadHigh,
    overloadTopN: params.overload.maxPrioritySituations,
  };
}
