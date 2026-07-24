import {
  HIGH_MISSING_INFO_CONFIDENCE_CAP,
  RISK_SUPPRESSION_FLOOR,
} from "./contract-constants";
import { clampUnit } from "./normalize";
import type {
  AppliedHardConstraint,
  PriorityActionCandidate,
  PriorityVector,
} from "./types";

export type HardConstraintContext = {
  emergencyOverride?: boolean;
  medicalSafetyStrict?: boolean;
  financialRiskCap?: number;
  caregiverDependencyProtected?: boolean;
  /** When true, suppress high-confidence irreversible / aggressive vectors. */
  highMissingInfoBlock?: boolean;
};

/**
 * Hard Constraint Filter — before final output to Action Generator.
 * Applies: medical safety, financial risk, caregiver dependency, emergency overrides.
 * Risk suppresses scores; high risk does NOT eliminate (floor retained).
 */
export function applyHardConstraintFilter(
  vectors: readonly PriorityVector[],
  candidates: readonly PriorityActionCandidate[],
  context: HardConstraintContext = {},
): {
  filtered: PriorityVector[];
  appliedConstraints: AppliedHardConstraint[];
} {
  const byId = new Map(candidates.map((c) => [c.actionId, c]));
  const appliedConstraints: AppliedHardConstraint[] = [];
  const filtered: PriorityVector[] = [];

  for (const vector of vectors) {
    const candidate = byId.get(vector.actionId);
    let next = { ...vector, components: { ...vector.components } };
    let score = next.totalScore;

    if (!candidate) {
      filtered.push(next);
      continue;
    }

    // Emergency override — elevate emergency / critical medical paths.
    if (context.emergencyOverride) {
      if (
        candidate.domain === "medical" ||
        candidate.urgencyClass === "CRITICAL"
      ) {
        score = clampUnit(Math.max(score, 0.85));
        appliedConstraints.push({
          kind: "emergency_override",
          actionId: vector.actionId,
          detail: "emergency override elevated medical/critical vector",
          suppressedScore: score,
        });
      }
    }

    // Medical safety — suppress unsafe aggressiveness under strict mode.
    if (context.medicalSafetyStrict && candidate.risk.medicalRisk >= 0.7) {
      const suppressed = Math.max(RISK_SUPPRESSION_FLOOR, score * 0.55);
      appliedConstraints.push({
        kind: "medical_safety",
        actionId: vector.actionId,
        detail: `medical safety suppressed score ${score.toFixed(3)} → ${suppressed.toFixed(3)}`,
        suppressedScore: suppressed,
      });
      score = suppressed;
      next.components.riskWeight = clampUnit(
        Math.max(next.components.riskWeight, candidate.risk.medicalRisk),
      );
    }

    // Financial risk — cap contribution when financial risk is elevated.
    const financialCap = context.financialRiskCap ?? 0.85;
    if (candidate.domain === "financial" && candidate.risk.financialRisk >= 0.6) {
      const suppressed = Math.max(
        RISK_SUPPRESSION_FLOOR,
        Math.min(score, financialCap * (1 - candidate.risk.financialRisk * 0.4)),
      );
      appliedConstraints.push({
        kind: "financial_risk",
        actionId: vector.actionId,
        detail: `financial risk suppressed score ${score.toFixed(3)} → ${suppressed.toFixed(3)}`,
        suppressedScore: suppressed,
      });
      score = suppressed;
    }

    // Caregiver dependency — protect dependent-bearing vectors from over-suppression.
    if (
      context.caregiverDependencyProtected &&
      candidate.dependency.dependents.length > 0
    ) {
      const floor = Math.max(RISK_SUPPRESSION_FLOOR, 0.12);
      if (score < floor) {
        score = floor;
        appliedConstraints.push({
          kind: "caregiver_dependency",
          actionId: vector.actionId,
          detail: `caregiver dependency floor applied at ${floor.toFixed(3)}`,
          suppressedScore: score,
        });
      }
    }

    // HIGH missing info — block high-confidence irreversible decision posture.
    // Suppress aggressive medical/financial vectors; force lower confidence.
    if (context.highMissingInfoBlock) {
      const irreversibleDomain =
        candidate.domain === "medical" || candidate.domain === "financial";
      const aggressive =
        candidate.urgencyClass === "CRITICAL" || candidate.urgencyClass === "HIGH";
      if (irreversibleDomain || aggressive) {
        const suppressed = Math.max(RISK_SUPPRESSION_FLOOR, score * 0.45);
        appliedConstraints.push({
          kind: "high_missing_info",
          actionId: vector.actionId,
          detail: `HIGH missing-info blocked high-confidence irreversible vector ${score.toFixed(3)} → ${suppressed.toFixed(3)}`,
          suppressedScore: suppressed,
        });
        score = suppressed;
      }
      next.confidence = Math.min(next.confidence, HIGH_MISSING_INFO_CONFIDENCE_CAP);
      next.uncertainty = Math.max(0, Math.min(1, 1 - next.confidence));
    }

    // Global: risk penalty never eliminates (floor).
    if (next.components.riskWeight >= 0.75 && score < RISK_SUPPRESSION_FLOOR) {
      score = RISK_SUPPRESSION_FLOOR;
    }

    filtered.push({
      ...next,
      totalScore: clampUnit(score),
    });
  }

  // Re-sort after constraint adjustment for deterministic ordering.
  filtered.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    return a.actionId.localeCompare(b.actionId);
  });

  return { filtered, appliedConstraints };
}
