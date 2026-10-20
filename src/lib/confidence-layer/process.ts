import {
  computeConfidenceState,
  type ComputeConfidenceInputs,
} from "../solenos-layers/derived/compute-confidence";
import type { ConfidenceLayerPayload, ConfidenceLayerResult } from "./types";

export function processConfidenceLayer(
  inputs: ComputeConfidenceInputs,
): ConfidenceLayerResult {
  const state = computeConfidenceState(inputs);
  const violations: string[] = [];
  if (!state.explanation?.trim()) {
    violations.push("confidence explanation must be non-empty plain English");
  }
  if (state.confidence < 0 || state.confidence > 100) {
    violations.push("confidence must be 0-100");
  }
  return {
    state,
    guarantee: { ok: violations.length === 0, violations },
  };
}

export function toConfidenceLayerPayload(
  result: ConfidenceLayerResult,
): ConfidenceLayerPayload {
  return {
    ...result.state,
    guaranteeOk: result.guarantee.ok,
  };
}

export type { ComputeConfidenceInputs };
