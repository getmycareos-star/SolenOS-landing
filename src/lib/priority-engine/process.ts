import type { CareProfile } from "../care-profile/types";
import type { SituationalCareContext } from "../care-context/situational/types";
import type { CaregiverDepletionSignalsResult } from "../caregiver-depletion-signals";
import type { BehaviorProfile } from "../input-classification";
import type {
  MemoryInfluenceEnvelope,
  MemoryInfluenceState,
} from "../memory-influence/types";
import type { AssumptionInfluenceEnvelope } from "../assumption-registry/types";
import type { MissingInformationInfluenceEnvelope } from "../missing-information-queue/types";
import {
  filterSituationsForPriority,
  filterSituationsForRisk,
  type TrackedSituation,
} from "../resolution-engine";
import type {
  GovernanceApplicationResult,
  SolenOSSettings,
} from "../settings-governance/types";
import {
  applySystemRiskToPriorityVectors,
  resolvePriorityTopNWithOverload,
} from "../situation-risk-register/bridge-priority";
import type { SystemRiskPriorityEnvelope } from "../situation-risk-register/types";
import type { TimeEngineLayerResult } from "../time-engine/types";
import type { UrgencyDetectionResult } from "../urgency-detection";
import type { EmotionalLoadSignalLayerResult } from "../emotional-load-signal";
import { applyLoadAwareTemporalReduction } from "../emotional-load-signal";
import { readPriorityWeightsFromSettings } from "./bridge-settings";
import { detectPriorityConflicts } from "./conflict";
import { applyHardConstraintFilter } from "./constraints";
import {
  DEFAULT_TOP_N,
  HIGH_MISSING_INFO_CONFIDENCE_CAP,
} from "./contract-constants";
import { derivePriorityCandidates } from "./derive-candidates";
import { runPriorityEngineGuarantee } from "./guarantee";
import { normalizeScore01 } from "./normalize";
import { selectTopN, sortPriorityVectors } from "./rank";
import {
  applyEmotionalWeightModifiers,
  computeDependencyWeight,
  computeEmotionalAmplification,
  computeMemoryReinforcement,
  computePriorityScore,
  computeRiskPenalty,
  computeUncertainty,
} from "./score";
import type {
  PriorityActionCandidate,
  PriorityEngineLayerPayload,
  PriorityEngineLayerResult,
  PriorityEngineWeightEnvelope,
  PriorityVector,
  PriorityWeights,
  SituationPriorityContractSnapshot,
} from "./types";
import {
  applyPriorityBehaviorWeightingFromEnvelope,
  mergePriorityWithModuleWeights,
} from "./weighting";
import {
  horizonToTimeUrgency,
  rankSituationsViaPriorityContract,
} from "./situation-contract";

export type ProcessPriorityEngineLayerParams = {
  timeEngine: TimeEngineLayerResult;
  memoryState?: MemoryInfluenceState;
  memoryEnvelope?: MemoryInfluenceEnvelope;
  assumptionEnvelope?: AssumptionInfluenceEnvelope;
  missingInformationEnvelope?: MissingInformationInfluenceEnvelope;
  /**
   * Situation Risk Register GLOBAL modifier —
   * priorityScore = base + systemRiskExposureWeight + missingInfoWeight + assumptionUncertainty
   */
  systemRiskEnvelope?: SystemRiskPriorityEnvelope;
  careProfile?: CareProfile;
  careContext?: SituationalCareContext;
  depletion?: CaregiverDepletionSignalsResult;
  urgencyDetection?: UrgencyDetectionResult;
  governanceSettings?: SolenOSSettings;
  /** Optional PriorityWeights overrides from settings/governance. */
  priorityWeights?: Partial<PriorityWeights>;
  /** Optional pre-built candidates — normally derived from upstream signals. */
  candidates?: readonly PriorityActionCandidate[];
  /**
   * Resolution Engine situations — when provided, ONLY ACTIVE participate
   * in ranking and risk. RESOLVED/ARCHIVED never pollute priority/risk.
   */
  trackedSituations?: readonly TrackedSituation[];
  topN?: number;
  /** Load-aware adjustment from Emotional Load Signal (early pipeline pass). */
  emotionalLoadSignal?: EmotionalLoadSignalLayerResult;
  nowMs?: number;
};

function scoreCandidate(
  candidate: PriorityActionCandidate,
  baseWeights: PriorityWeights,
): PriorityVector {
  const weights = applyEmotionalWeightModifiers(baseWeights, candidate.emotional);

  const T = normalizeScore01(candidate.temporalUrgency);
  const E = computeEmotionalAmplification(candidate.emotional);
  const M = computeMemoryReinforcement(candidate.memory);
  const { dependencyWeight: D } = computeDependencyWeight(candidate.dependency);
  const R = computeRiskPenalty(candidate.risk);

  const totalScore = computePriorityScore(
    {
      temporalUrgency: T,
      emotionalLoad: E,
      memoryReinforcement: M,
      dependencyWeight: D,
      riskPenalty: R,
    },
    weights,
  );

  const { uncertainty, confidence } = computeUncertainty(candidate.missingSignals);

  return {
    actionId: candidate.actionId,
    totalScore,
    components: {
      temporalWeight: T,
      emotionalWeight: E,
      memoryWeight: M,
      dependencyWeight: D,
      riskWeight: R,
    },
    confidence,
    uncertainty,
  };
}

/**
 * HIGH missing info → raise uncertainty + cap confidence.
 * Preserves confidence = 1 - uncertainty for Priority Engine guarantee.
 */
function applyMissingInformationConfidenceAdjustment(
  vector: PriorityVector,
  missingInformationEnvelope?: MissingInformationInfluenceEnvelope,
): PriorityVector {
  if (!missingInformationEnvelope || missingInformationEnvelope.highPriorityOpenCount <= 0) {
    return vector;
  }
  const penalty = missingInformationEnvelope.confidencePenalty;
  const boost = missingInformationEnvelope.uncertaintyBoost;
  const raisedUncertainty = Math.max(
    vector.uncertainty + boost,
    1 - vector.confidence * (1 - penalty),
  );
  const capped = Math.min(
    HIGH_MISSING_INFO_CONFIDENCE_CAP,
    Math.max(0, Math.min(1, 1 - raisedUncertainty)),
  );
  return {
    ...vector,
    confidence: capped,
    uncertainty: Math.max(0, Math.min(1, 1 - capped)),
  };
}

function emptyPriorityResult(
  baseWeights: PriorityWeights,
  situationContract?: SituationPriorityContractSnapshot,
): PriorityEngineLayerResult {
  const envelope: PriorityEngineWeightEnvelope = {
    topScore: 0,
    meanConfidence: 0,
    conflictCount: 0,
    passedCount: 0,
    riskPenaltyApplied: true,
  };
  const guarantee = runPriorityEngineGuarantee({
    weights: baseWeights,
    vectors: [],
    riskPenaltyApplied: true,
    dependencyEvaluated: true,
    signalsNormalized: true,
  });
  return {
    weights: baseWeights,
    candidates: [],
    vectors: [],
    rankedForActionGenerator: [],
    conflicts: [],
    appliedConstraints: [],
    envelope,
    guarantee,
    situationContract,
  };
}

function buildSituationContractSnapshot(
  params: ProcessPriorityEngineLayerParams,
): SituationPriorityContractSnapshot | undefined {
  if (!params.trackedSituations || params.trackedSituations.length === 0) {
    return undefined;
  }
  const activeHorizon = params.timeEngine.prioritySignal.activeHorizon;
  const timeUrgency = horizonToTimeUrgency(activeHorizon);
  // Approximate hours from horizon for TimeDecayFactor (objective, not preference).
  const hoursUntilDeadline =
    timeUrgency === "NOW"
      ? 0
      : timeUrgency === "TODAY"
        ? 12
        : timeUrgency === "SOON"
          ? 48
          : 96;
  const missingCriticalBySituationId: Record<string, number> = {};
  if (params.missingInformationEnvelope) {
    // Envelope is global; distribute critical-open signal onto ACTIVE situations evenly
    // only when situation-scoped counts are unavailable (objective floor = 0).
    const high = params.missingInformationEnvelope.highPriorityOpenCount;
    if (high > 0) {
      for (const s of filterSituationsForPriority(params.trackedSituations)) {
        missingCriticalBySituationId[s.id] = high;
      }
    }
  }
  const ranked = rankSituationsViaPriorityContract({
    trackedSituations: params.trackedSituations,
    timeUrgency,
    hoursUntilDeadline,
    missingCriticalBySituationId,
    situationType: params.careContext?.situationType,
  });
  return {
    rankedSituationIds: ranked.rankedSituationIds,
    topSituationId: ranked.topSituationId,
    overrideApplied: ranked.overrideApplied,
    scores: ranked.ranked.map((r) => ({
      situationId: r.situationId,
      priorityScore: r.priorityScore,
      safetyOverride: r.safetyOverride,
      reasons: r.reasons,
    })),
  };
}

/**
 * PRIORITY ENGINE (MATH FUSION) — after Time Engine;
 * before Conflict Resolver / Action Generator / Safety.
 * Computes scores only — ordered weighted decision vectors.
 * When trackedSituations are supplied, ONLY ACTIVE situations participate
 * (Resolution Engine filter) — RESOLVED/ARCHIVED never affect ranking or risk.
 */
export function processPriorityEngineLayer(
  params: ProcessPriorityEngineLayerParams,
): PriorityEngineLayerResult {
  const baseWeights = readPriorityWeightsFromSettings(
    params.governanceSettings,
    params.priorityWeights,
  );

  // Situation Priority Contract — authoritative situation ranking (pure).
  const situationContract = buildSituationContractSnapshot(params);

  // Resolution Engine gate: only ACTIVE for priority + risk.
  if (params.trackedSituations !== undefined) {
    const forPriority = filterSituationsForPriority(params.trackedSituations);
    const forRisk = filterSituationsForRisk(params.trackedSituations);
    if (forPriority.length === 0 || forRisk.length === 0) {
      return emptyPriorityResult(baseWeights, situationContract);
    }
  }

  const candidates =
    params.candidates && params.candidates.length > 0
      ? [...params.candidates].sort((a, b) => a.actionId.localeCompare(b.actionId))
      : derivePriorityCandidates({
          timeEngine: params.timeEngine,
          memoryState: params.memoryState,
          memoryEnvelope: params.memoryEnvelope,
          assumptionEnvelope: params.assumptionEnvelope,
          missingInformationEnvelope: params.missingInformationEnvelope,
          careProfile: params.careProfile,
          careContext: params.careContext,
          depletion: params.depletion,
          urgencyDetection: params.urgencyDetection,
          governanceSettings: params.governanceSettings,
          emotionalLoadSignal: params.emotionalLoadSignal,
          nowMs: params.nowMs,
        });

  // Emotional weight modifiers applied per-candidate inside scoreCandidate.
  // Aggregate burnout/grief for layer-level weight snapshot used in guarantee/payload.
  const anyBurnout = candidates.some((c) => c.emotional.burnout);
  const anyGrief = candidates.some((c) => c.emotional.grief);
  const weights = applyEmotionalWeightModifiers(baseWeights, {
    burnout: anyBurnout,
    grief: anyGrief,
  });

  const scored = candidates
    .map((c) => scoreCandidate(c, baseWeights))
    .map((v) =>
      applyMissingInformationConfidenceAdjustment(v, params.missingInformationEnvelope),
    );
  // GLOBAL system-risk modifier from Situation Risk Register (not per-situation only).
  const withSystemRisk = params.systemRiskEnvelope
    ? applySystemRiskToPriorityVectors(scored, params.systemRiskEnvelope)
    : scored;
  let sorted = sortPriorityVectors(withSystemRisk);

  const loadAdj = params.emotionalLoadSignal?.priorityAdjustment;
  if (
    params.emotionalLoadSignal?.detectionEnabled &&
    loadAdj?.deferNonCritical &&
    loadAdj.temporalWeightReduction > 0
  ) {
    sorted = sorted.map((v) => ({
      ...v,
      totalScore: applyLoadAwareTemporalReduction(
        v.totalScore,
        v.components.temporalWeight,
        loadAdj.temporalWeightReduction,
        true,
        params.careContext?.urgencyLevel === "CRITICAL" ||
          params.careContext?.situationType === "emergency",
      ),
    }));
    sorted = sortPriorityVectors(sorted);
  }

  const conflicts = detectPriorityConflicts(sorted, candidates);

  const emergencyOverride =
    params.careContext?.situationType === "emergency" ||
    params.careContext?.urgencyLevel === "CRITICAL" ||
    params.urgencyDetection?.risk_level === "critical";

  const medicalSafetyStrict =
    params.governanceSettings?.safetyControl.medicalMode === "restricted" ||
    params.governanceSettings?.systemMode === "CONSERVATIVE";

  const caregiverDependencyProtected =
    (params.careProfile?.careRelationships.dependents.length ?? 0) > 0;

  const highMissingInfoBlock =
    (params.missingInformationEnvelope?.highPriorityOpenCount ?? 0) > 0;

  const { filtered, appliedConstraints } = applyHardConstraintFilter(
    sorted,
    candidates,
    {
      emergencyOverride,
      medicalSafetyStrict,
      caregiverDependencyProtected,
      highMissingInfoBlock,
    },
  );

  const resolvedTopN = resolvePriorityTopNWithOverload(
    params.topN,
    params.systemRiskEnvelope ?? {
      systemRiskExposureWeight: 0,
      missingInfoWeight: 0,
      assumptionUncertainty: 0,
      overloadCollapseTopN: false,
      overloadTopN: DEFAULT_TOP_N,
    },
    DEFAULT_TOP_N,
  );
  const topN =
    params.emotionalLoadSignal?.detectionEnabled
      ? Math.min(
          resolvedTopN,
          params.emotionalLoadSignal.priorityAdjustment.adjustedTopN,
        )
      : resolvedTopN;
  const rankedForActionGenerator = selectTopN(filtered, topN);

  const meanConfidence =
    filtered.length === 0
      ? 0
      : filtered.reduce((sum, v) => sum + v.confidence, 0) / filtered.length;

  const envelope: PriorityEngineWeightEnvelope = {
    topScore: filtered[0]?.totalScore ?? 0,
    meanConfidence,
    conflictCount: conflicts.length,
    passedCount: rankedForActionGenerator.length,
    riskPenaltyApplied: filtered.every((v) => typeof v.components.riskWeight === "number"),
  };

  const guarantee = runPriorityEngineGuarantee({
    weights,
    vectors: filtered,
    riskPenaltyApplied: envelope.riskPenaltyApplied,
    dependencyEvaluated: candidates.every((c) => Array.isArray(c.dependency.dependents)),
    signalsNormalized: true,
  });

  return {
    weights,
    candidates,
    vectors: filtered,
    rankedForActionGenerator,
    conflicts,
    appliedConstraints,
    envelope,
    guarantee,
    situationContract,
  };
}

export function applyPriorityEngineBehaviorWeighting(
  behaviorProfile: BehaviorProfile,
  layer: PriorityEngineLayerResult,
): BehaviorProfile {
  return applyPriorityBehaviorWeightingFromEnvelope(behaviorProfile, layer.envelope);
}

export function applyPriorityEngineGovernanceWeighting(
  governance: GovernanceApplicationResult,
  layer: PriorityEngineLayerResult,
): GovernanceApplicationResult {
  const mergedWeights = mergePriorityWithModuleWeights(
    governance.moduleWeights,
    layer.envelope,
  );

  return {
    ...governance,
    moduleWeights: mergedWeights,
    appliedConstraints: [
      ...governance.appliedConstraints,
      {
        kind: "memory_module_weight",
        detail: `priorityEngine top=${layer.envelope.topScore.toFixed(2)} conflicts=${layer.envelope.conflictCount} passed=${layer.envelope.passedCount}`,
      },
    ],
  };
}

export function toPriorityEngineLayerPayload(
  layer: PriorityEngineLayerResult,
  topN: number = DEFAULT_TOP_N,
): PriorityEngineLayerPayload {
  return {
    vectorCount: layer.vectors.length,
    topN,
    topScore: layer.envelope.topScore,
    conflictCount: layer.conflicts.length,
    meanConfidence: layer.envelope.meanConfidence,
    weights: layer.weights,
    rankedActionIds: layer.rankedForActionGenerator.map((v) => v.actionId),
    conflictActionIds: [
      ...new Set(layer.conflicts.flatMap((c) => [c.actionIdA, c.actionIdB])),
    ],
    envelope: layer.envelope,
    rankedSituationIds: layer.situationContract?.rankedSituationIds,
    priorityOverrideApplied: layer.situationContract?.overrideApplied,
  };
}

/**
 * Observation tags for Action Generator — scores/flags only, never NL actions.
 */
export function formatPriorityEngineObservation(
  layer: PriorityEngineLayerResult,
): string {
  const top = layer.rankedForActionGenerator
    .slice(0, 3)
    .map((v) => `${v.actionId}:${v.totalScore.toFixed(2)}`)
    .join(",");
  const conflictFlag =
    layer.conflicts.length > 0
      ? ` conflicts=${layer.conflicts.length}→ConflictResolver`
      : "";
  const sit =
    layer.situationContract?.topSituationId !== undefined
      ? ` situations=${layer.situationContract.rankedSituationIds.slice(0, 3).join(",")}${layer.situationContract.overrideApplied ? " SAFETY_OVERRIDE" : ""}`
      : "";
  return `OBSERVATION: PRIORITY_ENGINE top=[${top}] conf=${layer.envelope.meanConfidence.toFixed(2)}${conflictFlag}${sit}`;
}
