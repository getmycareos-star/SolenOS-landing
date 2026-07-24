import type {
  OverloadSimplificationSignals,
  SystemRiskPriorityEnvelope,
  SystemRiskState,
} from "./types";

export function clamp0100(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function emptySystemRiskState(): SystemRiskState {
  return {
    totalRiskExposure: 0,
    riskDistribution: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
    dominantRiskCluster: [],
    riskVolatility: 0,
    overloadRisk: 0,
  };
}

export function emptyOverloadSignals(): OverloadSimplificationSignals {
  return {
    overloadHigh: false,
    reduceCognitiveComplexity: false,
    prioritizeTopSituationsOnly: false,
    maxPrioritySituations: 3,
    suppressSecondaryRecommendations: false,
    simplifyDecisionOutputs: false,
    reduceAutonomy: false,
    increaseConfirmation: false,
  };
}

export function emptyPriorityEnvelope(): SystemRiskPriorityEnvelope {
  return {
    systemRiskExposureWeight: 0,
    missingInfoWeight: 0,
    assumptionUncertainty: 0,
    overloadCollapseTopN: false,
    overloadTopN: 3,
  };
}
