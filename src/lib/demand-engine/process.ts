import type { BeliefItem } from "../solenos-layers/types";
import type { TrackedSituation } from "../resolution-engine/types";
import type { SituationalCareContext } from "../care-context/situational/types";
import { generateDemandsFromSituations } from "./generate";
import {
  buildDemandEngineOutput,
  rankDemandsByPressure,
  selectTopPressureDemands,
} from "./rank";
import {
  listDemands,
  mergeGeneratedDemands,
  resetDemandStore,
} from "./store";
import type {
  DemandEngineGuaranteeResult,
  DemandEngineLayerPayload,
  DemandEngineLayerResult,
  DemandGenerationSeed,
} from "./types";
import { DEFAULT_SURFACE_DEMAND_COUNT } from "./contract-constants";

export type ProcessDemandEngineParams = {
  careSessionId: string;
  trackedSituations?: readonly TrackedSituation[];
  /** Prefer STATE-shaped seeds when already synced. */
  situationSeeds?: readonly DemandGenerationSeed[];
  careContext?: SituationalCareContext;
  beliefs?: readonly BeliefItem[];
  /** Surface window hint (CLI may tighten further). */
  surfaceTopN?: number;
};

function beliefUncertaintyForSituation(
  situationId: string,
  beliefs: readonly BeliefItem[] | undefined,
): number {
  if (!beliefs || beliefs.length === 0) return 40;
  const related = beliefs.filter(
    (b) => b.situationId === situationId && b.status === "active",
  );
  if (related.length === 0) {
    const anyActive = beliefs.filter((b) => b.status === "active");
    if (anyActive.length === 0) return 35;
    const avgConf =
      anyActive.reduce((s, b) => s + b.confidence, 0) / anyActive.length;
    return Math.round((1 - avgConf) * 100);
  }
  const missing = related.filter((b) => b.type === "missing_information");
  const highMissing = missing.filter((b) => b.importance === "HIGH").length;
  const avgConf =
    related.reduce((s, b) => s + b.confidence, 0) / related.length;
  return Math.min(100, Math.round((1 - avgConf) * 80 + highMissing * 12 + missing.length * 5));
}

function seedsFromTracked(
  situations: readonly TrackedSituation[],
  careContext: SituationalCareContext | undefined,
  beliefs: readonly BeliefItem[] | undefined,
): DemandGenerationSeed[] {
  return situations
    .filter((s) => s.status === "ACTIVE")
    .map((s) => ({
      situationId: s.id,
      title: s.title,
      summary: s.title,
      situationType: careContext?.situationType,
      urgencyHint: careContext?.urgencyLevel,
      beliefUncertainty: beliefUncertaintyForSituation(s.id, beliefs),
    }));
}

export function runDemandEngineGuarantee(
  result: DemandEngineLayerResult,
): DemandEngineGuaranteeResult {
  const violations: string[] = [];
  for (const d of result.output.allDemands) {
    if (d.effort > 0 && d.pressureScore > 100) {
      violations.push(`pressureScore out of range for ${d.id}`);
    }
    // Effort must not inflate pressure beyond formula without effort.
    const withoutEffort =
      d.urgency * 0.35 +
      d.riskImpact * 0.35 +
      d.uncertainty * 0.2 +
      d.emotionalLoad * 0.1;
    if (Math.abs(d.pressureScore - withoutEffort) > 1.5) {
      violations.push(`effort leaked into pressureScore for ${d.id}`);
    }
  }
  const activeIds = new Set(result.output.activeDemands.map((d) => d.id));
  for (const d of result.rankedActive) {
    if (!activeIds.has(d.id)) {
      violations.push(`ranked demand ${d.id} not in active set`);
    }
  }
  return { ok: violations.length === 0, violations };
}

export function processDemandEngineLayer(
  params: ProcessDemandEngineParams,
): DemandEngineLayerResult {
  const seeds =
    params.situationSeeds ??
    seedsFromTracked(
      params.trackedSituations ?? [],
      params.careContext,
      params.beliefs,
    );

  const generated = generateDemandsFromSituations(seeds);
  mergeGeneratedDemands(params.careSessionId, generated);

  const all = listDemands(params.careSessionId);
  const output = buildDemandEngineOutput(all);
  const topN = params.surfaceTopN ?? DEFAULT_SURFACE_DEMAND_COUNT;
  const rankedActive = rankDemandsByPressure(output.activeDemands);
  const result: DemandEngineLayerResult = {
    output,
    rankedActive: selectTopPressureDemands(rankedActive, Math.max(topN, rankedActive.length)),
    guarantee: { ok: true, violations: [] },
  };
  result.guarantee = runDemandEngineGuarantee(result);
  // rankedActive for surface = full pressure order; consumers slice by CLI.
  result.rankedActive = rankedActive;
  return result;
}

export function toDemandEngineLayerPayload(
  layer: DemandEngineLayerResult,
  surfaceTopN = DEFAULT_SURFACE_DEMAND_COUNT,
): DemandEngineLayerPayload {
  const top = layer.rankedActive.slice(0, surfaceTopN);
  return {
    activeCount: layer.output.activeDemands.length,
    unresolvedCount: layer.output.unresolvedCount,
    topDemandIds: top.map((d) => d.id),
    topPressureScores: top.map((d) => d.pressureScore),
    caregiverLoadEstimate: layer.output.caregiverLoadEstimate,
    guaranteeOk: layer.guarantee.ok,
  };
}

export function formatDemandEngineObservation(layer: DemandEngineLayerResult): string {
  const top = layer.rankedActive[0];
  return `OBSERVATION: DEMAND_ENGINE active=${layer.output.activeDemands.length} unresolved=${layer.output.unresolvedCount} top=${top?.title ?? "none"} pressure=${top?.pressureScore.toFixed(1) ?? "0"} loadEst=${layer.output.caregiverLoadEstimate}`;
}

export { resetDemandStore };
