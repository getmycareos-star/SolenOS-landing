import { HIGH_PRESSURE_THRESHOLD } from "./contract-constants";
import { computePressureScore } from "./pressure";
import type { Demand, DemandEngineOutput } from "./types";

/** Rank demands by pressureScore descending (stable id tie-break). Effort ignored. */
export function rankDemandsByPressure(
  demands: readonly Demand[],
): Demand[] {
  return [...demands].sort((a, b) => {
    const pa = a.pressureScore ?? computePressureScore(a);
    const pb = b.pressureScore ?? computePressureScore(b);
    if (pb !== pa) return pb - pa;
    return a.id.localeCompare(b.id);
  });
}

export function isActiveDemandStatus(
  status: Demand["status"],
): status is "pending" | "in_progress" {
  return status === "pending" || status === "in_progress";
}

export function buildDemandEngineOutput(
  allDemands: readonly Demand[],
): DemandEngineOutput {
  const refreshed = allDemands.map((d) => ({
    ...d,
    pressureScore: computePressureScore(d),
  }));
  const activeDemands = rankDemandsByPressure(
    refreshed.filter((d) => isActiveDemandStatus(d.status)),
  );
  const pressureScores = activeDemands.map((d) => ({
    demandId: d.id,
    pressureScore: d.pressureScore,
  }));
  const unresolvedCount = activeDemands.length;
  const meanPressure =
    activeDemands.length === 0
      ? 0
      : activeDemands.reduce((s, d) => s + d.pressureScore, 0) / activeDemands.length;
  const caregiverLoadEstimate = Math.min(
    100,
    Math.round(activeDemands.length * 1.5 + (meanPressure / 100) * 20),
  );

  return {
    activeDemands,
    allDemands: refreshed,
    pressureScores,
    unresolvedCount,
    caregiverLoadEstimate,
  };
}

export function countHighPressureDemands(
  demands: readonly Demand[],
  threshold = HIGH_PRESSURE_THRESHOLD,
): number {
  return demands.filter(
    (d) => isActiveDemandStatus(d.status) && d.pressureScore >= threshold,
  ).length;
}

/** Select top-N highest-pressure active demands for Decision Surface. */
export function selectTopPressureDemands(
  demands: readonly Demand[],
  topN: number,
): Demand[] {
  const n = Math.max(0, Math.floor(topN));
  return rankDemandsByPressure(
    demands.filter((d) => isActiveDemandStatus(d.status)),
  ).slice(0, n);
}
