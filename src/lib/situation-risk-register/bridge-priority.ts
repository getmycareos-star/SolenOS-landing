import { clampUnit } from "../priority-engine/normalize";
import type { PriorityVector } from "../priority-engine/types";
import { OVERLOAD_PRIORITY_TOP_N } from "./contract-constants";
import type { SystemRiskPriorityEnvelope } from "./types";

/**
 * GLOBAL Priority Engine modifier (not per-situation only):
 * priorityScore = baseUrgency + systemRiskExposureWeight + missingInfoWeight + assumptionUncertainty
 */
export function applySystemRiskToPriorityScore(
  baseScore: number,
  envelope: SystemRiskPriorityEnvelope,
): number {
  const raw =
    baseScore +
    envelope.systemRiskExposureWeight +
    envelope.missingInfoWeight +
    envelope.assumptionUncertainty;
  return clampUnit(raw);
}

export function applySystemRiskToPriorityVectors(
  vectors: readonly PriorityVector[],
  envelope: SystemRiskPriorityEnvelope,
): PriorityVector[] {
  if (
    envelope.systemRiskExposureWeight <= 0 &&
    envelope.missingInfoWeight <= 0 &&
    envelope.assumptionUncertainty <= 0
  ) {
    return [...vectors];
  }

  return vectors.map((v) => {
    const uncertainty = clampUnit(
      v.uncertainty +
        envelope.missingInfoWeight * 0.5 +
        envelope.assumptionUncertainty * 0.35,
    );
    return {
      ...v,
      totalScore: applySystemRiskToPriorityScore(v.totalScore, envelope),
      uncertainty,
      confidence: clampUnit(1 - uncertainty),
    };
  });
}

/** When overload HIGH — Priority Engine must emit only top 1–2. */
export function resolvePriorityTopNWithOverload(
  requestedTopN: number | undefined,
  envelope: SystemRiskPriorityEnvelope,
  defaultTopN: number,
): number {
  const base = requestedTopN ?? defaultTopN;
  if (!envelope.overloadCollapseTopN) return base;
  return Math.min(base, envelope.overloadTopN || OVERLOAD_PRIORITY_TOP_N);
}
