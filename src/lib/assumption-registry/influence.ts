import { ASSUMPTION_INFLUENCE_CAP } from "./contract-constants";
import { isAssumptionStale } from "./expiration";
import { isInfluenceableStatus } from "./lifecycle";
import type {
  Assumption,
  AssumptionHealth,
  AssumptionInfluenceEnvelope,
  AssumptionRegistryState,
} from "./types";

export function getInfluenceableAssumptions(
  state: AssumptionRegistryState,
): Assumption[] {
  return state.assumptions.filter((a) => isInfluenceableStatus(a.status));
}

export function collectAssumptionHealth(
  state: AssumptionRegistryState,
  nowMs: number = Date.now(),
): AssumptionHealth {
  let activeAssumptions = 0;
  let expiredAssumptions = 0;
  let invalidatedAssumptions = 0;
  let staleAssumptions = 0;

  for (const assumption of state.assumptions) {
    switch (assumption.status) {
      case "active":
      case "validated":
        activeAssumptions += 1;
        if (isAssumptionStale(assumption, state.policy, nowMs)) {
          staleAssumptions += 1;
        }
        break;
      case "expired":
        expiredAssumptions += 1;
        break;
      case "invalidated":
        invalidatedAssumptions += 1;
        break;
      default:
        break;
    }
  }

  return {
    activeAssumptions,
    expiredAssumptions,
    invalidatedAssumptions,
    staleAssumptions,
  };
}

function summarizeForHint(assumption: Assumption, stale: boolean): string {
  const verified = assumption.status === "validated" ? "verified" : "active";
  const staleTag = stale ? ", stale" : "";
  return `${verified}${staleTag}: ${assumption.statement.slice(0, 80)}`;
}

/**
 * Soft bias envelope for Priority Engine — influence only, not facts.
 */
export function computeAssumptionInfluenceEnvelope(
  state: AssumptionRegistryState,
  nowMs: number = Date.now(),
): AssumptionInfluenceEnvelope {
  const influenceable = getInfluenceableAssumptions(state);
  const health = collectAssumptionHealth(state, nowMs);

  if (influenceable.length === 0) {
    return {
      compositeBias: 0,
      influenceableCount: 0,
      influenceHints: [],
      staleInfluenceCount: 0,
      health,
    };
  }

  let staleInfluenceCount = 0;
  const hints: string[] = [];
  let biasSum = 0;

  for (const assumption of influenceable) {
    const stale = isAssumptionStale(assumption, state.policy, nowMs);
    if (stale) staleInfluenceCount += 1;
    const stalePenalty = stale ? 0.5 : 1;
    const validatedBoost = assumption.status === "validated" ? 1.1 : 1;
    biasSum += assumption.confidence * stalePenalty * validatedBoost;
    hints.push(summarizeForHint(assumption, stale));
  }

  const rawBias = biasSum / influenceable.length;
  const staleDampen = staleInfluenceCount > 0 ? 0.85 : 1;
  const compositeBias = Math.min(
    ASSUMPTION_INFLUENCE_CAP,
    rawBias * staleDampen * ASSUMPTION_INFLUENCE_CAP,
  );

  return {
    compositeBias,
    influenceableCount: influenceable.length,
    influenceHints: hints.slice(0, 5),
    staleInfluenceCount,
    health,
  };
}
