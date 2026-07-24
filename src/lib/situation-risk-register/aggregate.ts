import type { CareProfile } from "../care-profile/types";
import type { AssumptionInfluenceEnvelope } from "../assumption-registry/types";
import type { MissingInformationInfluenceEnvelope } from "../missing-information-queue/types";
import {
  ASSUMPTION_INSTABILITY_VOLATILITY_WEIGHT,
  DEPENDENCY_MULTIPLIER_PCT,
  OVERLAP_PENALTY_MAX_PCT,
  OVERLAP_PENALTY_MIN_PCT,
  UNCERTAINTY_PENALTY_COEFFICIENT,
} from "./contract-constants";
import { selectDominantRiskCluster } from "./cluster";
import { clamp0100 } from "./defaults";
import type {
  RiskCluster,
  SituationRisk,
  SystemRiskState,
} from "./types";

export type AggregationBreakdown = {
  sumAdjustedRisk: number;
  overlapPenalty: number;
  uncertaintyPenalty: number;
  dependencyMultiplier: number;
  computedBeforeClamp: number;
};

/**
 * Overlap penalty: situationsInHighRiskCluster × 8–15%.
 * Scales toward MAX as cluster density / criticality rises.
 */
export function computeOverlapPenalty(
  situationRisks: readonly SituationRisk[],
  clusters: readonly RiskCluster[],
): number {
  const highCriticalCount = situationRisks.filter(
    (r) => r.baseRisk === "HIGH" || r.baseRisk === "CRITICAL",
  ).length;
  if (highCriticalCount < 2) return 0;

  const highCluster = clusters.find(
    (c) =>
      c.clusterKind === "high_risk_overlap" ||
      (c.situations.length >= 2 &&
        (c.clusterRiskLevel === "HIGH" || c.clusterRiskLevel === "CRITICAL")),
  );
  const situationsInHighRiskCluster =
    highCluster?.situations.length ?? highCriticalCount;

  const criticalShare =
    situationRisks.filter((r) => r.baseRisk === "CRITICAL").length /
    Math.max(1, highCriticalCount);
  const pct =
    OVERLAP_PENALTY_MIN_PCT +
    (OVERLAP_PENALTY_MAX_PCT - OVERLAP_PENALTY_MIN_PCT) * criticalShare;

  return situationsInHighRiskCluster * pct;
}

/**
 * uncertaintyPenalty = missingInfoWeight × 0.6 (+ assumption instability).
 * missingInfoWeight is 0–100 scale.
 */
export function computeUncertaintyPenalty(params: {
  missingInformationEnvelope?: MissingInformationInfluenceEnvelope;
  assumptionEnvelope?: AssumptionInfluenceEnvelope;
  situationRisks: readonly SituationRisk[];
}): number {
  const open = params.missingInformationEnvelope?.openCount ?? 0;
  const high = params.missingInformationEnvelope?.highPriorityOpenCount ?? 0;
  const missingInfoWeight = Math.min(
    100,
    high * 25 + Math.max(0, open - high) * 10,
  );

  const meanUncertainty =
    params.situationRisks.length === 0
      ? 0
      : (params.situationRisks.reduce(
          (sum, r) => sum + r.riskDrivers.uncertaintyFactor,
          0,
        ) /
          params.situationRisks.length) *
        100;

  const base = Math.max(missingInfoWeight, meanUncertainty) * UNCERTAINTY_PENALTY_COEFFICIENT;

  const stale = params.assumptionEnvelope?.staleInfluenceCount ?? 0;
  const bias = params.assumptionEnvelope?.compositeBias ?? 0;
  const assumptionInstability =
    (bias * 40 + Math.min(20, stale * 6)) * ASSUMPTION_INSTABILITY_VOLATILITY_WEIGHT;

  return base + assumptionInstability;
}

/**
 * dependencyMultiplier = numberOfSharedCareDependencies × 5%.
 */
export function computeDependencyMultiplier(careProfile?: CareProfile): number {
  const shared =
    (careProfile?.careRelationships.sharedCareWith.length ?? 0) +
    (careProfile?.careRelationships.externalCaregivers.length ?? 0);
  const dependents = careProfile?.careRelationships.dependents.length ?? 0;
  // Shared-care edges drive the multiplier; multi-dependent households amplify slightly.
  const numberOfSharedCareDependencies = shared + Math.max(0, dependents - 1);
  return numberOfSharedCareDependencies * DEPENDENCY_MULTIPLIER_PCT;
}

/**
 * totalRiskExposure = Σ(adjustedRisk) + overlapPenalty + uncertaintyPenalty + dependencyMultiplier
 * Normalize: clamp(0, 100, computedValue)
 *
 * Multiple MEDIUM adjusted scores sum past overload (>75) — systemic stress, not labels alone.
 */
export function aggregateSystemRisk(params: {
  situationRisks: readonly SituationRisk[];
  clusters: readonly RiskCluster[];
  careProfile?: CareProfile;
  missingInformationEnvelope?: MissingInformationInfluenceEnvelope;
  assumptionEnvelope?: AssumptionInfluenceEnvelope;
}): { systemRisk: SystemRiskState; breakdown: AggregationBreakdown } {
  const risks = params.situationRisks;
  const distribution = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  for (const r of risks) {
    distribution[r.baseRisk] += 1;
  }

  const sumAdjustedRisk = risks.reduce((sum, r) => sum + r.adjustedRisk, 0);

  const overlapPenalty = computeOverlapPenalty(risks, params.clusters);
  const uncertaintyPenalty = computeUncertaintyPenalty({
    missingInformationEnvelope: params.missingInformationEnvelope,
    assumptionEnvelope: params.assumptionEnvelope,
    situationRisks: risks,
  });
  const dependencyMultiplier = computeDependencyMultiplier(params.careProfile);

  const computedBeforeClamp =
    sumAdjustedRisk + overlapPenalty + uncertaintyPenalty + dependencyMultiplier;
  const totalRiskExposure = clamp0100(computedBeforeClamp);

  const dominantRiskCluster = selectDominantRiskCluster(params.clusters, risks);

  const adjustedValues = risks.map((r) => r.adjustedRisk);
  let spread = 0;
  if (adjustedValues.length >= 2) {
    const mean =
      adjustedValues.reduce((a, b) => a + b, 0) / adjustedValues.length;
    const variance =
      adjustedValues.reduce((a, b) => a + (b - mean) ** 2, 0) /
      adjustedValues.length;
    spread = Math.sqrt(variance);
  }
  const assumptionVol =
    ((params.assumptionEnvelope?.staleInfluenceCount ?? 0) * 8 +
      (params.assumptionEnvelope?.compositeBias ?? 0) * 30) *
    ASSUMPTION_INSTABILITY_VOLATILITY_WEIGHT;
  const riskVolatility = clamp0100(spread + assumptionVol);

  // Cognitive saturation tracks exposure; exceeds overload band when > 75.
  const overloadRisk = clamp0100(totalRiskExposure);

  return {
    systemRisk: {
      totalRiskExposure,
      riskDistribution: distribution,
      dominantRiskCluster,
      riskVolatility,
      overloadRisk,
    },
    breakdown: {
      sumAdjustedRisk,
      overlapPenalty,
      uncertaintyPenalty,
      dependencyMultiplier,
      computedBeforeClamp,
    },
  };
}
