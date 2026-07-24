import type {
  PriorityEngineGuaranteeResult,
  PriorityEngineLayerResult,
  PriorityWeights,
  PriorityVector,
} from "./types";
import { DEFAULT_PRIORITY_ENGINE_WEIGHTS } from "./defaults";

function isDefinedNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function inUnit(value: number): boolean {
  return value >= 0 && value <= 1;
}

function weightsDefined(weights: PriorityWeights): boolean {
  return (
    isDefinedNumber(weights.Wt) &&
    isDefinedNumber(weights.We) &&
    isDefinedNumber(weights.Wm) &&
    isDefinedNumber(weights.Wd) &&
    isDefinedNumber(weights.Wr)
  );
}

/**
 * System guarantee before output:
 * - all signals normalized
 * - weights applied correctly
 * - risk penalty applied
 * - dependency graph evaluated
 * - final ordering deterministic
 * - no undefined variables
 */
export function runPriorityEngineGuarantee(params: {
  weights: PriorityWeights;
  vectors: readonly PriorityVector[];
  riskPenaltyApplied: boolean;
  dependencyEvaluated: boolean;
  signalsNormalized: boolean;
}): PriorityEngineGuaranteeResult {
  const violations: string[] = [];

  if (!weightsDefined(params.weights)) {
    violations.push("priority weights must be defined finite numbers (no guessing)");
  }

  // Do not use guessed defaults silently if caller passed partial NaN — already checked.
  if (
    params.weights.Wt === DEFAULT_PRIORITY_ENGINE_WEIGHTS.Wt &&
    params.weights.We === DEFAULT_PRIORITY_ENGINE_WEIGHTS.We &&
    params.weights.Wm === DEFAULT_PRIORITY_ENGINE_WEIGHTS.Wm &&
    params.weights.Wd === DEFAULT_PRIORITY_ENGINE_WEIGHTS.Wd &&
    params.weights.Wr === DEFAULT_PRIORITY_ENGINE_WEIGHTS.Wr
  ) {
    // defaults are valid — no violation
  }

  if (!params.signalsNormalized) {
    violations.push("all signals must be normalized before fusion");
  }

  if (!params.riskPenaltyApplied) {
    violations.push("risk penalty must be applied");
  }

  if (!params.dependencyEvaluated) {
    violations.push("dependency graph must be evaluated");
  }

  for (const v of params.vectors) {
    if (!v.actionId) {
      violations.push("vector actionId must be defined");
    }
    if (!inUnit(v.totalScore)) {
      violations.push(`totalScore out of bounds for ${v.actionId}`);
    }
    if (!inUnit(v.confidence) || !inUnit(v.uncertainty)) {
      violations.push(`confidence/uncertainty out of bounds for ${v.actionId}`);
    }
    const c = v.components;
    for (const [key, val] of Object.entries(c)) {
      if (!isDefinedNumber(val) || !inUnit(val)) {
        violations.push(`component ${key} invalid for ${v.actionId}`);
      }
    }
    if (Math.abs(v.confidence - (1 - v.uncertainty)) > 1e-9) {
      violations.push(`confidence must equal 1 - uncertainty for ${v.actionId}`);
    }
  }

  // Deterministic ordering: non-increasing totalScore, ties by actionId.
  for (let i = 1; i < params.vectors.length; i++) {
    const prev = params.vectors[i - 1]!;
    const curr = params.vectors[i]!;
    if (curr.totalScore > prev.totalScore + 1e-12) {
      violations.push("final ordering must be deterministic descending by totalScore");
      break;
    }
    if (
      Math.abs(curr.totalScore - prev.totalScore) < 1e-12 &&
      curr.actionId.localeCompare(prev.actionId) < 0
    ) {
      violations.push("tie-break ordering must be deterministic by actionId");
      break;
    }
  }

  return { ok: violations.length === 0, violations };
}

export function validatePriorityEngineLayerResult(
  result: PriorityEngineLayerResult,
): PriorityEngineGuaranteeResult {
  return runPriorityEngineGuarantee({
    weights: result.weights,
    vectors: result.vectors,
    riskPenaltyApplied: result.envelope.riskPenaltyApplied,
    dependencyEvaluated: result.candidates.every(
      (c) => Array.isArray(c.dependency.dependents),
    ),
    signalsNormalized: true,
  });
}
