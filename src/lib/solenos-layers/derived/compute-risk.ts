import type { BeliefItem, DerivedRiskResult, StatePriority, StateSituation } from "../types";
import { computeBeliefInfluence } from "../belief/influence";

function clamp0100(n: number): number {
  return Math.max(0, Math.min(100, n));
}

function priorityToBase(p: StatePriority): number {
  switch (p) {
    case "CRITICAL":
      return 90;
    case "HIGH":
      return 70;
    case "MEDIUM":
      return 45;
    case "LOW":
    default:
      return 20;
  }
}

/**
 * Pure derived risk over STATE + BELIEF.
 * NOT a persistent Risk Engine / Register — no risk database.
 */
export function computeRisk(
  situations: readonly StateSituation[],
  beliefs: readonly BeliefItem[],
): DerivedRiskResult {
  const active = situations.filter((s) => s.status === "active");
  const influence = computeBeliefInfluence(beliefs);

  const situationRisks = active.map((s) => {
    const sitBeliefs = beliefs.filter((b) => b.situationId === s.id);
    const sitInfluence = computeBeliefInfluence(sitBeliefs);
    const base = priorityToBase(s.priority);
    const adjusted = clamp0100(
      base +
        sitInfluence.uncertaintyBoost * 25 +
        sitInfluence.missingInfoConfidencePenalty * 20 +
        sitInfluence.assumptionBias * 10,
    );
    return {
      situationId: s.id,
      adjustedRisk: adjusted,
      baseLevel: s.priority,
    };
  });

  const sum = situationRisks.reduce((acc, r) => acc + r.adjustedRisk, 0);
  const systemRiskExposure = clamp0100(
    sum / Math.max(1, situationRisks.length) +
      influence.uncertaintyBoost * 15 +
      (influence.highMissingInfoCount > 0 ? 10 : 0),
  );

  return {
    situationRisks,
    systemRiskExposure,
    overload: systemRiskExposure >= 75 && active.length >= 3,
  };
}
