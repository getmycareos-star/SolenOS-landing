import { DEFAULT_TOP_N } from "./contract-constants";
import type { PriorityVector } from "./types";

/**
 * sortedActions = actions.sort((a,b) => b.totalScore - a.totalScore)
 * Ties broken by actionId for deterministic ordering.
 */
export function sortPriorityVectors(
  vectors: readonly PriorityVector[],
): PriorityVector[] {
  return [...vectors].sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    return a.actionId.localeCompare(b.actionId);
  });
}

/** Only top N actions (usually 1–3) passed to Action Generator. */
export function selectTopN(
  vectors: readonly PriorityVector[],
  topN: number = DEFAULT_TOP_N,
): PriorityVector[] {
  const n = Math.max(0, Math.floor(topN));
  return sortPriorityVectors(vectors).slice(0, n);
}
