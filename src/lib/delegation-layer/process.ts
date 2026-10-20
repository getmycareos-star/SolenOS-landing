import {
  computeDelegationSuggestions,
  type ComputeDelegationInputs,
} from "../solenos-layers/derived/compute-delegation";
import type { DelegationLayerPayload, DelegationLayerResult } from "./types";

export function processDelegationLayer(
  inputs: ComputeDelegationInputs,
): DelegationLayerResult {
  const loadElevated =
    inputs.caregiverLoadState === "HIGH" || inputs.caregiverLoadState === "CRITICAL";
  const suggestions = computeDelegationSuggestions(inputs);
  const violations: string[] = [];
  if (!loadElevated && suggestions.length > 0) {
    violations.push("delegation suggestions must only appear when load is HIGH/CRITICAL");
  }
  for (const s of suggestions) {
    if (!s.task?.trim() || !s.recommendedPerson?.trim() || !s.reason?.trim()) {
      violations.push("delegation suggestion fields must be non-empty");
    }
  }
  return {
    suggestions,
    loadElevated,
    guarantee: { ok: violations.length === 0, violations },
  };
}

export function toDelegationLayerPayload(
  result: DelegationLayerResult,
): DelegationLayerPayload {
  return {
    suggestions: result.suggestions,
    loadElevated: result.loadElevated,
    guaranteeOk: result.guarantee.ok,
  };
}

export type { ComputeDelegationInputs };
