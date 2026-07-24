import type { CareProfile } from "../care-profile/types";
import type { SituationalCareContext } from "../care-context/situational/types";
import type { AssumptionInfluenceEnvelope } from "../assumption-registry/types";
import type { BehaviorProfile } from "../input-classification";
import type {
  MissingInformationInfluenceEnvelope,
  MissingInformationQueueState,
} from "../missing-information-queue/types";
import { getOpenMissingInformationItems } from "../missing-information-queue/influence";
import {
  filterSituationsForRisk,
  type TrackedSituation,
} from "../resolution-engine";
import type { GovernanceApplicationResult } from "../settings-governance/types";
import type { TimeEngineLayerResult } from "../time-engine/types";
import type { UrgencyDetectionResult } from "../urgency-detection";
import { aggregateSystemRisk } from "./aggregate";
import {
  applyOverloadSafetySimplification,
  applySituationRiskGovernanceWeighting,
} from "./bridge-safety";
import { buildRiskClusters } from "./cluster";
import { computeSituationRisk } from "./compute-situation-risk";
import {
  emptyOverloadSignals,
  emptyPriorityEnvelope,
  emptySystemRiskState,
} from "./defaults";
import { runSituationRiskRegisterGuarantee } from "./guarantee";
import {
  buildSystemRiskPriorityEnvelope,
  detectOverload,
} from "./overload";
import {
  applySituationRiskBehaviorWeighting,
  mergeSituationRiskWithModuleWeights,
} from "./weighting";
import type {
  SituationRiskRegisterLayerPayload,
  SituationRiskRegisterLayerResult,
} from "./types";
import type { SolenOSResponse } from "../response-validator";
import type { AppliedSafetyConstraint } from "../safety-enforcement/types";

export type ProcessSituationRiskRegisterLayerParams = {
  trackedSituations: readonly TrackedSituation[];
  careContext?: SituationalCareContext;
  careProfile?: CareProfile;
  timeEngine?: TimeEngineLayerResult;
  urgencyDetection?: UrgencyDetectionResult;
  missingInformationState?: MissingInformationQueueState;
  missingInformationEnvelope?: MissingInformationInfluenceEnvelope;
  assumptionEnvelope?: AssumptionInfluenceEnvelope;
};

/**
 * SITUATION RISK REGISTER — after Resolution ACTIVE filter + Missing Info + Assumptions;
 * feeds Priority Engine as a GLOBAL system-risk modifier.
 * ONLY ACTIVE situations participate.
 */
export function processSituationRiskRegisterLayer(
  params: ProcessSituationRiskRegisterLayerParams,
): SituationRiskRegisterLayerResult {
  const active = filterSituationsForRisk(params.trackedSituations);

  if (active.length === 0) {
    const systemRisk = emptySystemRiskState();
    const overload = emptyOverloadSignals();
    const priorityEnvelope = emptyPriorityEnvelope();
    const layer: SituationRiskRegisterLayerResult = {
      situationRisks: [],
      systemRisk,
      clusters: [],
      overload,
      priorityEnvelope,
      aggregationBreakdown: {
        sumAdjustedRisk: 0,
        overlapPenalty: 0,
        uncertaintyPenalty: 0,
        dependencyMultiplier: 0,
        computedBeforeClamp: 0,
      },
      guarantee: { ok: true, violations: [] },
    };
    layer.guarantee = runSituationRiskRegisterGuarantee({
      trackedSituations: params.trackedSituations,
      layer,
    });
    return layer;
  }

  const situationRisks = active.map((situation) => {
    const openMissingInfo = params.missingInformationState
      ? getOpenMissingInformationItems(params.missingInformationState, situation.id)
      : [];
    return computeSituationRisk({
      situation,
      careContext: params.careContext,
      careProfile: params.careProfile,
      timeEngine: params.timeEngine,
      urgencyDetection: params.urgencyDetection,
      openMissingInfo,
      assumptionEnvelope: params.assumptionEnvelope,
    });
  });

  const clusters = buildRiskClusters({
    activeSituations: active,
    situationRisks,
    careProfile: params.careProfile,
    careContext: params.careContext,
    timeEngine: params.timeEngine,
  });

  const { systemRisk, breakdown } = aggregateSystemRisk({
    situationRisks,
    clusters,
    careProfile: params.careProfile,
    missingInformationEnvelope: params.missingInformationEnvelope,
    assumptionEnvelope: params.assumptionEnvelope,
  });

  const overload = detectOverload(systemRisk);
  const priorityEnvelope = buildSystemRiskPriorityEnvelope({
    systemRisk,
    overload,
    missingInformationEnvelope: params.missingInformationEnvelope,
    assumptionEnvelope: params.assumptionEnvelope,
  });

  const layer: SituationRiskRegisterLayerResult = {
    situationRisks,
    systemRisk,
    clusters,
    overload,
    priorityEnvelope,
    aggregationBreakdown: breakdown,
    guarantee: { ok: true, violations: [] },
  };
  layer.guarantee = runSituationRiskRegisterGuarantee({
    trackedSituations: params.trackedSituations,
    layer,
  });
  return layer;
}

export function applySituationRiskRegisterBehaviorWeighting(
  behaviorProfile: BehaviorProfile,
  layer: SituationRiskRegisterLayerResult,
): BehaviorProfile {
  return applySituationRiskBehaviorWeighting(behaviorProfile, {
    systemRisk: layer.systemRisk,
    overload: layer.overload,
  });
}

export function applySituationRiskRegisterGovernanceWeighting(
  governance: GovernanceApplicationResult,
  layer: SituationRiskRegisterLayerResult,
): GovernanceApplicationResult {
  const withRouting = applySituationRiskGovernanceWeighting(governance, {
    systemRisk: layer.systemRisk,
    overload: layer.overload,
  });
  const mergedWeights = mergeSituationRiskWithModuleWeights(
    withRouting.moduleWeights,
    layer.priorityEnvelope,
    layer.overload,
  );
  return {
    ...withRouting,
    moduleWeights: mergedWeights,
  };
}

export function applySituationRiskRegisterSafetySimplification(
  response: SolenOSResponse,
  layer: SituationRiskRegisterLayerResult,
  applied: AppliedSafetyConstraint[] = [],
): SolenOSResponse {
  return applyOverloadSafetySimplification(response, layer.overload, applied);
}

export function toSituationRiskRegisterLayerPayload(
  layer: SituationRiskRegisterLayerResult,
): SituationRiskRegisterLayerPayload {
  return {
    totalRiskExposure: layer.systemRisk.totalRiskExposure,
    overloadRisk: layer.systemRisk.overloadRisk,
    overloadHigh: layer.overload.overloadHigh,
    riskVolatility: layer.systemRisk.riskVolatility,
    riskDistribution: layer.systemRisk.riskDistribution,
    dominantRiskCluster: layer.systemRisk.dominantRiskCluster,
    situationCount: layer.situationRisks.length,
    clusterCount: layer.clusters.length,
    priorityEnvelope: layer.priorityEnvelope,
    overload: layer.overload,
  };
}

export function formatSituationRiskRegisterObservation(
  layer: SituationRiskRegisterLayerResult,
): string {
  const d = layer.systemRisk.riskDistribution;
  return `OBSERVATION: SITUATION_RISK_REGISTER exposure=${layer.systemRisk.totalRiskExposure.toFixed(1)} overload=${layer.overload.overloadHigh} dist=L${d.LOW}/M${d.MEDIUM}/H${d.HIGH}/C${d.CRITICAL} vol=${layer.systemRisk.riskVolatility.toFixed(1)} clusters=${layer.clusters.length}`;
}
