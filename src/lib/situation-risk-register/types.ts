import type { BASE_RISK_LEVELS } from "./contract-constants";

export type BaseRiskLevel = (typeof BASE_RISK_LEVELS)[number];

export type SituationRiskDrivers = {
  urgency: number;
  medicalSeverity: number;
  dependencyLevel: number;
  timeSensitivity: number;
  /** From Missing Information Queue (open gaps for this situation). */
  uncertaintyFactor: number;
};

export type SituationRisk = {
  situationId: string;
  baseRisk: BaseRiskLevel;
  /** 0–100 continuous adjusted risk after drivers + assumption instability. */
  adjustedRisk: number;
  riskDrivers: SituationRiskDrivers;
};

export type SystemRiskState = {
  /** 0–100 clamped systemic exposure. */
  totalRiskExposure: number;
  riskDistribution: {
    LOW: number;
    MEDIUM: number;
    HIGH: number;
    CRITICAL: number;
  };
  /** situationIds in the dominant / highest-burden cluster. */
  dominantRiskCluster: string[];
  /** 0–100 volatility from assumption instability + risk spread. */
  riskVolatility: number;
  /** 0–100 cognitive saturation / overload signal. */
  overloadRisk: number;
};

export type RiskCluster = {
  situations: string[];
  clusterRiskLevel: BaseRiskLevel;
  /** Why this cluster was grouped. */
  clusterKind:
    | "same_dependent"
    | "same_time_window"
    | "shared_medical_dependency"
    | "insurance_dependency_overlap"
    | "high_risk_overlap"
    | "singleton";
};

export type OverloadSimplificationSignals = {
  overloadHigh: boolean;
  /** Reduce cognitive output complexity. */
  reduceCognitiveComplexity: boolean;
  /** Prioritize ONLY top 1–2 situations. */
  prioritizeTopSituationsOnly: boolean;
  maxPrioritySituations: number;
  /** Suppress secondary recommendations. */
  suppressSecondaryRecommendations: boolean;
  /** Simplify decision outputs. */
  simplifyDecisionOutputs: boolean;
  /** Reduce Decision/Safety autonomy; increase confirmation. */
  reduceAutonomy: boolean;
  increaseConfirmation: boolean;
};

/** Soft influence envelope consumed by Priority Engine as a GLOBAL modifier. */
export type SystemRiskPriorityEnvelope = {
  /** 0–1 weight from totalRiskExposure / 100. */
  systemRiskExposureWeight: number;
  /** 0–1 from Missing Information Queue. */
  missingInfoWeight: number;
  /** 0–1 from Assumption Registry instability. */
  assumptionUncertainty: number;
  /** When true, Priority Engine must collapse top-N to 1–2. */
  overloadCollapseTopN: boolean;
  overloadTopN: number;
};

export type SituationRiskRegisterGuaranteeResult = {
  ok: boolean;
  violations: string[];
};

export type SituationRiskRegisterLayerResult = {
  situationRisks: readonly SituationRisk[];
  systemRisk: SystemRiskState;
  clusters: readonly RiskCluster[];
  overload: OverloadSimplificationSignals;
  priorityEnvelope: SystemRiskPriorityEnvelope;
  /** Aggregation audit — pre-clamp components. */
  aggregationBreakdown: {
    sumAdjustedRisk: number;
    overlapPenalty: number;
    uncertaintyPenalty: number;
    dependencyMultiplier: number;
    computedBeforeClamp: number;
  };
  guarantee: SituationRiskRegisterGuaranteeResult;
};

export type SituationRiskRegisterLayerPayload = {
  totalRiskExposure: number;
  overloadRisk: number;
  overloadHigh: boolean;
  riskVolatility: number;
  riskDistribution: SystemRiskState["riskDistribution"];
  dominantRiskCluster: readonly string[];
  situationCount: number;
  clusterCount: number;
  priorityEnvelope: SystemRiskPriorityEnvelope;
  overload: OverloadSimplificationSignals;
};
