import { filterSituationsForRisk } from "../resolution-engine";
import type { TrackedSituation } from "../resolution-engine/types";
import { OVERLOAD_RISK_THRESHOLD } from "./contract-constants";
import type { SituationRiskRegisterLayerResult } from "./types";

export function runSituationRiskRegisterGuarantee(params: {
  trackedSituations?: readonly TrackedSituation[];
  layer: SituationRiskRegisterLayerResult;
}): SituationRiskRegisterLayerResult["guarantee"] {
  const violations: string[] = [];
  const { layer } = params;

  if (
    layer.systemRisk.totalRiskExposure < 0 ||
    layer.systemRisk.totalRiskExposure > 100
  ) {
    violations.push("totalRiskExposure must be clamped to 0–100");
  }
  if (layer.systemRisk.overloadRisk < 0 || layer.systemRisk.overloadRisk > 100) {
    violations.push("overloadRisk must be clamped to 0–100");
  }
  if (layer.systemRisk.riskVolatility < 0 || layer.systemRisk.riskVolatility > 100) {
    violations.push("riskVolatility must be clamped to 0–100");
  }

  for (const risk of layer.situationRisks) {
    if (risk.adjustedRisk < 0 || risk.adjustedRisk > 100) {
      violations.push(`adjustedRisk out of range for ${risk.situationId}`);
    }
  }

  if (params.trackedSituations) {
    const activeIds = new Set(
      filterSituationsForRisk(params.trackedSituations).map((s) => s.id),
    );
    for (const risk of layer.situationRisks) {
      if (!activeIds.has(risk.situationId)) {
        violations.push(
          `non-ACTIVE situation included in risk register: ${risk.situationId}`,
        );
      }
    }
    for (const s of params.trackedSituations) {
      if (
        (s.status === "RESOLVED" || s.status === "ARCHIVED") &&
        layer.situationRisks.some((r) => r.situationId === s.id)
      ) {
        violations.push(`RESOLVED/ARCHIVED must not contribute risk: ${s.id}`);
      }
    }
  }

  const overloadHigh = layer.systemRisk.totalRiskExposure > OVERLOAD_RISK_THRESHOLD;
  if (overloadHigh !== layer.overload.overloadHigh) {
    violations.push("overload.overloadHigh must match totalRiskExposure > 75");
  }
  if (overloadHigh && !layer.overload.reduceCognitiveComplexity) {
    violations.push("overload HIGH must reduce cognitive complexity");
  }
  if (overloadHigh && layer.overload.maxPrioritySituations > 2) {
    violations.push("overload HIGH must prioritize only top 1–2 situations");
  }

  return { ok: violations.length === 0, violations };
}

export function validateSituationRiskRegisterLayerResult(
  layer: SituationRiskRegisterLayerResult,
  trackedSituations?: readonly TrackedSituation[],
): SituationRiskRegisterLayerResult["guarantee"] {
  return runSituationRiskRegisterGuarantee({ layer, trackedSituations });
}
