import type { BeliefItem } from "../solenos-layers/types";
import type { CareProfile } from "../care-profile/types";
import type { SituationalCareContext } from "../care-context/situational/types";
import type { Demand } from "../demand-engine/types";
import {
  countHighPressureDemands,
  isActiveDemandStatus,
} from "../demand-engine/rank";
import {
  classifyLoadState,
  computeCaregiverLoad,
  surfaceLimitForState,
} from "./compute";
import { constrainDemandsByLoad } from "./surface";
import type { InteractionLoadSignalResult } from "../interaction-load-signal/types";
import { applyInteractionLoadToCliInputs } from "../interaction-load-signal/integrate-cli";
import type {
  CaregiverLoadGuaranteeResult,
  CaregiverLoadInputs,
  CaregiverLoadLayerPayload,
  CaregiverLoadLayerResult,
} from "./types";

export type ProcessCaregiverLoadParams = {
  demands: readonly Demand[];
  unresolvedSituationCount?: number;
  beliefs?: readonly BeliefItem[];
  careProfile?: CareProfile;
  careContext?: SituationalCareContext;
  /** Optional 0–100 overrides when upstream already computed components. */
  uncertaintyLoad?: number;
  conflictLoad?: number;
  coordinationLoad?: number;
  timePressureLoad?: number;
  pendingConflictCount?: number;
  /** High-signal stress floors from caregiver text detection. */
  uncertaintyLoadFloor?: number;
  conflictLoadFloor?: number;
  /** Interaction Load Signal — cognitive/boundary boosts into CLI. */
  interactionLoadLayer?: InteractionLoadSignalResult;
};

function deriveUncertaintyLoad(beliefs: readonly BeliefItem[] | undefined): number {
  if (!beliefs || beliefs.length === 0) return 20;
  const active = beliefs.filter((b) => b.status === "active");
  if (active.length === 0) return 15;
  const missing = active.filter((b) => b.type === "missing_information");
  const high = missing.filter((b) => b.importance === "HIGH").length;
  const avgConf = active.reduce((s, b) => s + b.confidence, 0) / active.length;
  return Math.min(100, Math.round((1 - avgConf) * 70 + missing.length * 8 + high * 12));
}

function deriveConflictLoad(
  careProfile: CareProfile | undefined,
  demands: readonly Demand[],
  pendingConflictCount?: number,
): number {
  const familyDemands = demands.filter(
    (d) => isActiveDemandStatus(d.status) && d.category === "family_conflict",
  ).length;
  const pending = pendingConflictCount ?? 0;
  const shared = careProfile?.careRelationships.sharedCareWith.length ?? 0;
  return Math.min(100, familyDemands * 25 + pending * 20 + (shared > 2 ? 15 : 0));
}

function deriveCoordinationLoad(
  careProfile: CareProfile | undefined,
  demands: readonly Demand[],
): number {
  const coord = demands.filter(
    (d) =>
      isActiveDemandStatus(d.status) &&
      (d.category === "care_coordination" || d.category === "transportation"),
  ).length;
  const external = careProfile?.careRelationships.externalCaregivers.length ?? 0;
  const shared = careProfile?.careRelationships.sharedCareWith.length ?? 0;
  const workload =
    careProfile?.workloadIntensity === "HIGH"
      ? 30
      : careProfile?.workloadIntensity === "MEDIUM"
        ? 15
        : 5;
  return Math.min(100, coord * 18 + external * 10 + shared * 8 + workload);
}

function deriveTimePressureLoad(
  careContext: SituationalCareContext | undefined,
  careProfile: CareProfile | undefined,
): number {
  const tp = careContext?.environmentSignals.timePressure;
  const fromContext =
    tp === "high" ? 80 : tp === "medium" ? 50 : tp === "low" ? 25 : 10;
  const urgency = careContext?.urgencyLevel;
  const urgencyBoost =
    urgency === "CRITICAL" ? 25 : urgency === "HIGH" ? 15 : urgency === "MEDIUM" ? 5 : 0;
  // Profile timeSensitivity is morning|night|unpredictable — boost unpredictable schedule pressure.
  const profileBoost =
    careProfile?.timeSensitivity === "unpredictable"
      ? 15
      : careProfile?.timeSensitivity === "night"
        ? 10
        : 5;
  return Math.min(100, fromContext + urgencyBoost + profileBoost);
}

function prolongedUnresolvedBoost(unresolvedSituationCount: number): number {
  if (unresolvedSituationCount <= 1) return 0;
  if (unresolvedSituationCount === 2) return 2;
  if (unresolvedSituationCount === 3) return 4;
  return Math.min(12, unresolvedSituationCount * 2);
}

export function buildCaregiverLoadInputs(
  params: ProcessCaregiverLoadParams,
): CaregiverLoadInputs {
  const active = params.demands.filter((d) => isActiveDemandStatus(d.status));
  const baseUncertainty =
    params.uncertaintyLoad ?? deriveUncertaintyLoad(params.beliefs);
  const baseConflict =
    params.conflictLoad ??
    deriveConflictLoad(params.careProfile, params.demands, params.pendingConflictCount);

  return {
    activeDemandCount: active.length,
    highPressureDemandCount: countHighPressureDemands(params.demands),
    unresolvedSituationCount: params.unresolvedSituationCount ?? 0,
    uncertaintyLoad: Math.max(baseUncertainty, params.uncertaintyLoadFloor ?? 0),
    conflictLoad: Math.max(baseConflict, params.conflictLoadFloor ?? 0),
    coordinationLoad:
      params.coordinationLoad ??
      deriveCoordinationLoad(params.careProfile, params.demands),
    timePressureLoad:
      params.timePressureLoad ??
      deriveTimePressureLoad(params.careContext, params.careProfile),
    prolongedUnresolvedBoost: prolongedUnresolvedBoost(
      params.unresolvedSituationCount ?? 0,
    ),
  };
}

export function runCaregiverLoadGuarantee(
  result: CaregiverLoadLayerResult,
): CaregiverLoadGuaranteeResult {
  const violations: string[] = [];
  const { load, surfaceLimit } = result;
  if (load.score < 0 || load.score > 100) {
    violations.push("load score out of 0–100");
  }
  if (classifyLoadState(load.score) !== load.state) {
    violations.push("load state does not match score band");
  }
  if (surfaceLimit !== surfaceLimitForState(load.state)) {
    violations.push("surfaceLimit mismatch for load state");
  }
  if (load.state === "CRITICAL" && surfaceLimit !== 1) {
    violations.push("CRITICAL must constrain to 1 demand");
  }
  if (load.state === "HIGH" && surfaceLimit !== 2) {
    violations.push("HIGH must constrain to 2 demands");
  }
  return { ok: violations.length === 0, violations };
}

export function processCaregiverLoadLayer(
  params: ProcessCaregiverLoadParams,
): CaregiverLoadLayerResult {
  let inputs = buildCaregiverLoadInputs(params);
  if (params.interactionLoadLayer) {
    inputs = applyInteractionLoadToCliInputs(inputs, params.interactionLoadLayer);
  }
  const load = computeCaregiverLoad(inputs);
  const surfaceLimit = surfaceLimitForState(load.state);
  const result: CaregiverLoadLayerResult = {
    load,
    surfaceLimit,
    guarantee: { ok: true, violations: [] },
  };
  result.guarantee = runCaregiverLoadGuarantee(result);
  return result;
}

export function toCaregiverLoadLayerPayload(
  layer: CaregiverLoadLayerResult,
): CaregiverLoadLayerPayload {
  return {
    caregiverLoadState: layer.load.state,
    caregiverLoadScore: layer.load.score,
    surfaceLimit: layer.surfaceLimit,
    activeDemandCount: layer.load.activeDemandCount,
    highPressureDemandCount: layer.load.highPressureDemandCount,
    guaranteeOk: layer.guarantee.ok,
  };
}

export function formatCaregiverLoadObservation(layer: CaregiverLoadLayerResult): string {
  return `OBSERVATION: CAREGIVER_LOAD state=${layer.load.state} score=${layer.load.score.toFixed(1)} surface=${layer.surfaceLimit} activeDemands=${layer.load.activeDemandCount} highPressure=${layer.load.highPressureDemandCount}`;
}

export function selectSurfaceDemandsForLoad(
  demands: readonly Demand[],
  layer: CaregiverLoadLayerResult,
): Demand[] {
  return constrainDemandsByLoad(demands, layer.load);
}
