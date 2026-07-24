import {
  computeCrisisRisks,
  type ComputeCrisisRisksInputs,
} from "../solenos-layers/derived/compute-crisis-risks";
import type {
  CrisisPreventionLayerPayload,
  CrisisPreventionLayerResult,
} from "./types";

export function processCrisisPreventionLayer(
  inputs: ComputeCrisisRisksInputs,
): CrisisPreventionLayerResult {
  const risks = computeCrisisRisks(inputs);
  const violations: string[] = [];
  for (const risk of risks) {
    if (!risk.explanation?.trim()) {
      violations.push(`crisis risk ${risk.situationId} missing explanation`);
    }
    if (risk.probability < 0 || risk.probability > 1) {
      violations.push(`crisis risk ${risk.situationId} probability out of range`);
    }
  }
  return {
    risks,
    guarantee: { ok: violations.length === 0, violations },
  };
}

export function toCrisisPreventionLayerPayload(
  result: CrisisPreventionLayerResult,
): CrisisPreventionLayerPayload {
  return {
    risks: result.risks,
    topRiskProbability: result.risks[0]?.probability ?? 0,
    guaranteeOk: result.guarantee.ok,
  };
}

export type { ComputeCrisisRisksInputs };
