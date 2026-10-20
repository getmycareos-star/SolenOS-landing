import {
  CONFLICT_MIN_SCORE,
  CONFLICT_SCORE_SIMILARITY_THRESHOLD,
} from "./contract-constants";
import type {
  PriorityActionCandidate,
  PriorityConflictFlag,
  PriorityVector,
} from "./types";

/**
 * Conflict detection — flag only.
 * If two actions have similar scores + different domains + different urgency
 * → flag conflict for Conflict Resolver. Do NOT resolve here.
 */
export function detectPriorityConflicts(
  vectors: readonly PriorityVector[],
  candidates: readonly PriorityActionCandidate[],
): PriorityConflictFlag[] {
  const byId = new Map(candidates.map((c) => [c.actionId, c]));
  const flags: PriorityConflictFlag[] = [];

  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      const a = vectors[i]!;
      const b = vectors[j]!;
      if (a.totalScore < CONFLICT_MIN_SCORE && b.totalScore < CONFLICT_MIN_SCORE) {
        continue;
      }

      const scoreDelta = Math.abs(a.totalScore - b.totalScore);
      if (scoreDelta > CONFLICT_SCORE_SIMILARITY_THRESHOLD) continue;

      const candA = byId.get(a.actionId);
      const candB = byId.get(b.actionId);
      if (!candA || !candB) continue;

      if (candA.domain === candB.domain) continue;
      if (candA.urgencyClass === candB.urgencyClass) continue;

      flags.push({
        actionIdA: a.actionId,
        actionIdB: b.actionId,
        scoreA: a.totalScore,
        scoreB: b.totalScore,
        domainA: candA.domain,
        domainB: candB.domain,
        urgencyA: candA.urgencyClass,
        urgencyB: candB.urgencyClass,
        detail: `similar scores (${a.totalScore.toFixed(3)} vs ${b.totalScore.toFixed(3)}) across domains ${candA.domain}/${candB.domain} with urgency ${candA.urgencyClass}/${candB.urgencyClass} — deferred to Conflict Resolver`,
        unresolved: true,
      });
    }
  }

  return flags;
}
