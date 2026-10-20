import type { BeliefItem } from "../types";
import { countHighImportanceMissingInformation } from "./store";

/**
 * Soft influence from beliefs onto decision confidence interpretation.
 * Beliefs NEVER execute actions — only influence STATE interpretation.
 *
 * Optional openConflicts: Conflict Detection lowers confidence / blocks CRITICAL medical.
 * Conflicts are not a 4th truth layer — they modulate BELIEF confidence only.
 */
export type BeliefInfluenceEnvelope = {
  assumptionBias: number;
  missingInfoConfidencePenalty: number;
  /** Soft reduction from open Conflict Detection registry conflicts. */
  conflictConfidencePenalty: number;
  uncertaintyBoost: number;
  highMissingInfoBlocked: boolean;
  highMissingInfoCount: number;
  /** CRITICAL open medical conflicts restrict high-confidence decisions. */
  criticalConflictBlocked: boolean;
  influenceHints: readonly string[];
  needsNext: readonly string[];
};

export type ConflictBeliefInput = {
  confidencePenalty?: number;
  criticalDecisionRestricted?: boolean;
  clarificationQuestion?: string | null;
};

export function computeBeliefInfluence(
  beliefs: readonly BeliefItem[],
  conflict?: ConflictBeliefInput | null,
): BeliefInfluenceEnvelope {
  const assumptions = beliefs.filter(
    (b) =>
      b.type === "assumption" &&
      (b.status === "active" || b.status === "confirmed"),
  );
  const missing = beliefs.filter(
    (b) => b.type === "missing_information" && b.status === "active",
  );
  const highCount = countHighImportanceMissingInformation(beliefs);

  const assumptionBias = Math.min(
    0.25,
    assumptions.reduce((sum, a) => sum + a.confidence * 0.08, 0),
  );

  const confidencePenalty = Math.min(
    0.45,
    highCount * 0.15 +
      missing.filter((m) => m.importance === "MEDIUM").length * 0.05,
  );

  const conflictConfidencePenalty = Math.min(
    0.55,
    Math.max(0, conflict?.confidencePenalty ?? 0),
  );

  const uncertaintyBoost = Math.min(
    0.5,
    highCount * 0.12 +
      missing.filter((m) => m.importance === "MEDIUM").length * 0.04 +
      conflictConfidencePenalty * 0.4,
  );

  const needsNext = [...missing]
    .sort((a, b) => {
      const rank = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;
      return (
        (rank[a.importance ?? "LOW"] ?? 2) - (rank[b.importance ?? "LOW"] ?? 2)
      );
    })
    .slice(0, 5)
    .map((m) => m.content);

  // Prefer single conflict clarification ahead of other needs — never dump counts.
  if (conflict?.clarificationQuestion) {
    needsNext.unshift(conflict.clarificationQuestion);
  }

  return {
    assumptionBias,
    missingInfoConfidencePenalty: confidencePenalty,
    conflictConfidencePenalty,
    uncertaintyBoost,
    highMissingInfoBlocked: highCount > 0,
    highMissingInfoCount: highCount,
    criticalConflictBlocked: conflict?.criticalDecisionRestricted === true,
    influenceHints: assumptions.slice(0, 5).map((a) => a.content),
    needsNext: needsNext.slice(0, 5),
  };
}
