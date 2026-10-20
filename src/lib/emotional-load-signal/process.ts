import type { BeliefItem } from "../solenos-layers/types";
import type { CareProfile } from "../care-profile/types";
import type { SituationalCareContext } from "../care-context/situational/types";
import type { CaregiverDepletionSignalsResult } from "../caregiver-depletion-signals";
import type { CaregiverLoad } from "../caregiver-load-index/types";
import type { Demand } from "../demand-engine/types";
import type {
  MemoryInfluenceEnvelope,
} from "../memory-influence/types";
import type { SolenOSSettings } from "../settings-governance/types";
import type { TrackedSituation } from "../resolution-engine";
import { isActiveDemandStatus } from "../demand-engine/rank";
import { countHighPressureDemands } from "../demand-engine/rank";
import { computeEmotionalLoadSignal, classifyCognitiveFatigue, buildCognitiveFatigueExplanation } from "./compute";
import {
  runEmotionalLoadGuarantee,
  runPostDecisionEmotionalLoadGuarantee,
} from "./guarantee";
import {
  computeLoadAwarePriorityAdjustment,
  evaluateCaregiverProtectionMode,
  mergeProtectionConstraints,
  type ProtectionModeRiskContext,
} from "./protection-mode";
import { computeRecommendationLoadMetadata } from "./recommendation-metadata";
import type { LoadInterpretation } from "../load-interpretation/types";
import { applyLoadInterpretationToEmotionalInputs } from "../load-interpretation/integrate-emotional-load";
import type { InteractionLoadSignalResult } from "../interaction-load-signal/types";
import { applyInteractionLoadToEmotionalInputs } from "../interaction-load-signal/integrate-emotional-load";
import type {
  EmotionalLoadSignalInputs,
  EmotionalLoadSignalLayerPayload,
  EmotionalLoadSignalLayerResult,
  PostDecisionEmotionalLoadResult,
} from "./types";

export type ProcessEmotionalLoadSignalParams = {
  caregiverLoad: CaregiverLoad;
  demands: readonly Demand[];
  beliefs?: readonly BeliefItem[];
  activeSituations?: readonly TrackedSituation[];
  memoryEnvelope?: MemoryInfluenceEnvelope;
  depletion?: CaregiverDepletionSignalsResult;
  careProfile?: CareProfile;
  careContext?: SituationalCareContext;
  pendingConflictCount?: number;
  governanceSettings?: SolenOSSettings;
  /** CLI surface limit — base topN before load-aware adjustment. */
  baseTopN: number;
  /** Load-First Interpretation boosts — sleepRisk, uncertaintyIndex into burnout/fatigue. */
  loadInterpretation?: LoadInterpretation;
  /** Interaction Load Signal — repetition/boundary/sleep boosts. */
  interactionLoadLayer?: InteractionLoadSignalResult;
};

function depletionFactor(depletion?: CaregiverDepletionSignalsResult): number {
  if (!depletion) return 0.1;
  if (depletion.caregiver_depletion_state === "critical") return 0.85;
  if (depletion.caregiver_depletion_state === "elevated") return 0.55;
  return 0.15;
}

function countHighUrgencyDemands(demands: readonly Demand[]): number {
  return demands.filter(
    (d) => isActiveDemandStatus(d.status) && d.urgency >= 70,
  ).length;
}

function groupDemandsBySituation(
  demands: readonly Demand[],
): Record<string, { demandCount: number; highPressure: number; urgencySum: number }> {
  const map: Record<string, { demandCount: number; highPressure: number; urgencySum: number }> =
    {};
  for (const d of demands) {
    if (!isActiveDemandStatus(d.status)) continue;
    const cur = map[d.situationId] ?? { demandCount: 0, highPressure: 0, urgencySum: 0 };
    cur.demandCount += 1;
    cur.urgencySum += d.urgency;
    if (d.pressureScore >= 60) cur.highPressure += 1;
    map[d.situationId] = cur;
  }
  return map;
}

export function buildEmotionalLoadSignalInputs(
  params: ProcessEmotionalLoadSignalParams,
): EmotionalLoadSignalInputs {
  const active = params.demands.filter((d) => isActiveDemandStatus(d.status));
  const unresolved =
    params.activeSituations?.filter((s) => s.status === "ACTIVE").length ??
    params.caregiverLoad.unresolvedSituationCount;

  return {
    activeSituationCount: params.activeSituations?.length ?? Math.max(1, unresolved),
    unresolvedSituationCount: unresolved,
    activeDemandCount: active.length,
    highPressureDemandCount: countHighPressureDemands(params.demands),
    highUrgencyDemandCount: countHighUrgencyDemands(params.demands),
    pendingConflictCount: params.pendingConflictCount ?? 0,
    uncertaintyLoad: params.caregiverLoad.uncertaintyLoad,
    conflictLoad: params.caregiverLoad.conflictLoad,
    operationalLoadScore: params.caregiverLoad.score,
    emotionalBias: params.memoryEnvelope?.emotionalBias ?? 0,
    depletionFactor: depletionFactor(params.depletion),
    demandsBySituation: groupDemandsBySituation(params.demands),
  };
}

function isEmotionalLoadDetectionEnabled(settings?: SolenOSSettings): boolean {
  if (!settings) return true;
  return settings.emotionalControl.emotionalLoadDetection !== false;
}

/**
 * Early pipeline pass — compute signal + load-aware priority adjustment.
 * Position: after CLI, before Priority Engine.
 */
export function processEmotionalLoadSignalLayer(
  params: ProcessEmotionalLoadSignalParams,
): EmotionalLoadSignalLayerResult {
  const detectionEnabled = isEmotionalLoadDetectionEnabled(params.governanceSettings);
  let inputs = buildEmotionalLoadSignalInputs(params);
  if (params.loadInterpretation) {
    inputs = applyLoadInterpretationToEmotionalInputs(inputs, params.loadInterpretation);
  }
  if (params.interactionLoadLayer) {
    inputs = applyInteractionLoadToEmotionalInputs(inputs, params.interactionLoadLayer);
  }
  let signal = computeEmotionalLoadSignal(inputs);

  if (
    params.loadInterpretation &&
    (params.loadInterpretation.loadFirstMode ||
      params.loadInterpretation.emotionalLoadScore >= 55)
  ) {
    const compositeFloor = Math.min(
      100,
      params.loadInterpretation.emotionalLoadScore * 0.85 +
        params.loadInterpretation.sleepRisk * 35,
    );
    if (compositeFloor > signal.compositeScore) {
      const level = classifyCognitiveFatigue(compositeFloor);
      signal = {
        ...signal,
        compositeScore: compositeFloor,
        cognitiveFatigue: {
          level,
          explanation: buildCognitiveFatigueExplanation(level, signal.stressIndicators),
        },
      };
    }
  }

  const priorityAdjustment = computeLoadAwarePriorityAdjustment(
    signal,
    params.baseTopN,
    detectionEnabled,
  );

  const protectionMode = evaluateCaregiverProtectionMode(
    signal,
    {
      medicalOrTimeSensitive:
        params.careContext?.urgencyLevel === "CRITICAL" ||
        params.careContext?.situationType === "emergency",
    },
    detectionEnabled,
  );

  const mergedProtection = mergeProtectionConstraints(protectionMode, priorityAdjustment);

  const result: EmotionalLoadSignalLayerResult = {
    signal,
    priorityAdjustment,
    protectionMode: mergedProtection,
    detectionEnabled,
    guarantee: { ok: true, violations: [] },
  };
  result.guarantee = runEmotionalLoadGuarantee(result);
  return result;
}

export type ApplyPostDecisionEmotionalLoadParams = {
  layer: EmotionalLoadSignalLayerResult;
  chosenActionId: string;
  chosenDemand?: Demand | null;
  baseSurfaceLimit: number;
  riskContext: ProtectionModeRiskContext;
  isMultiStep?: boolean;
};

/**
 * Post-decision pass — protection mode, output constraints, recommendation metadata.
 * Position: after Decision Engine, before Fail-Safe Mode.
 */
export function applyPostDecisionEmotionalLoad(
  params: ApplyPostDecisionEmotionalLoadParams,
): PostDecisionEmotionalLoadResult {
  const { layer, chosenActionId, chosenDemand, baseSurfaceLimit, riskContext } = params;
  const detectionEnabled = layer.detectionEnabled;

  const protectionMode = evaluateCaregiverProtectionMode(
    layer.signal,
    riskContext,
    detectionEnabled,
  );
  const mergedProtection = mergeProtectionConstraints(
    protectionMode,
    layer.priorityAdjustment,
  );

  const recommendationMetadata = computeRecommendationLoadMetadata({
    signal: layer.signal,
    chosenActionId,
    chosenDemand,
    isMultiStep: params.isMultiStep,
  });

  const maxActions = detectionEnabled
    ? Math.min(
        baseSurfaceLimit,
        mergedProtection.constraints.maxActions,
        layer.priorityAdjustment.adjustedTopN,
      )
    : baseSurfaceLimit;

  const outputConstraints = {
    maxActions,
    allowBranching: detectionEnabled ? mergedProtection.constraints.allowBranching : true,
    simplifyOutput: detectionEnabled ? mergedProtection.constraints.simplifyOutput : false,
  };

  const result: PostDecisionEmotionalLoadResult = {
    protectionMode: mergedProtection,
    recommendationMetadata,
    outputConstraints,
    effectiveSurfaceLimit: maxActions,
    guarantee: { ok: true, violations: [] },
  };
  result.guarantee = runPostDecisionEmotionalLoadGuarantee(result);
  return result;
}

export function toEmotionalLoadSignalLayerPayload(
  layer: EmotionalLoadSignalLayerResult,
): EmotionalLoadSignalLayerPayload {
  return {
    cognitiveFatigueLevel: layer.signal.cognitiveFatigue.level,
    burnoutProbability: layer.signal.burnoutProbability.value,
    burnoutReasoning: layer.signal.burnoutProbability.reasoning,
    stressComposite: layer.signal.stressIndicators.composite,
    compositeScore: layer.signal.compositeScore,
    protectionModeEngaged: layer.protectionMode.engaged,
    adjustedTopN: layer.priorityAdjustment.adjustedTopN,
    deferNonCritical: layer.priorityAdjustment.deferNonCritical,
    simplifyRecommendations: layer.priorityAdjustment.simplifyRecommendations,
    perSituationCount: layer.signal.perSituation.length,
    recoveryMinutesStub: layer.signal.recoveryTimeEstimate.estimatedMinutes,
    detectionEnabled: layer.detectionEnabled,
    guaranteeOk: layer.guarantee.ok,
  };
}

export function formatEmotionalLoadSignalObservation(
  layer: EmotionalLoadSignalLayerResult,
): string {
  const s = layer.signal;
  return `OBSERVATION: EMOTIONAL_LOAD fatigue=${s.cognitiveFatigue.level} burnout=${(s.burnoutProbability.value * 100).toFixed(0)}% stress=${s.stressIndicators.composite.toFixed(0)} topN=${layer.priorityAdjustment.adjustedTopN} protection=${layer.protectionMode.engaged}`;
}
