import { computeBeliefInfluence } from "../belief/influence";
import type {
  BeliefItem,
  ExplanationHealthSummary,
  StateSituation,
} from "../types";

/**
 * Pure health summary over STATE + BELIEF — EXPLANATION derived view only.
 * Not an active Health Engine. Autonomy gating lives in computeAutonomyGate.
 */
export function computeHealthSummary(
  situations: readonly StateSituation[],
  beliefs: readonly BeliefItem[],
): ExplanationHealthSummary {
  const active = situations.filter((s) => s.status === "active");
  const influence = computeBeliefInfluence(beliefs);

  let overallScore = 0.85;
  const reasons: string[] = [];

  if (influence.highMissingInfoCount > 0) {
    overallScore -= Math.min(0.35, influence.highMissingInfoCount * 0.12);
    reasons.push("high-priority missing information gaps");
  }
  if (influence.missingInfoConfidencePenalty > 0.2) {
    overallScore -= 0.1;
    reasons.push("elevated missing-information confidence penalty");
  }
  if (active.length >= 5) {
    overallScore -= 0.15;
    reasons.push("high active situation load");
  } else if (active.length === 0) {
    overallScore -= 0.05;
  }

  const invalidated = beliefs.filter((b) => b.status === "invalidated").length;
  if (invalidated >= 3) {
    overallScore -= 0.1;
    reasons.push("multiple invalidated beliefs");
  }

  overallScore = Math.max(0, Math.min(1, overallScore));

  const band: ExplanationHealthSummary["band"] =
    overallScore >= 0.7 ? "Healthy" : overallScore >= 0.45 ? "Degraded" : "Unreliable";

  const degraded = band !== "Healthy";

  return {
    band,
    overallScore,
    summary:
      band === "Healthy"
        ? "Decision readiness is healthy."
        : `Decision readiness is ${band.toLowerCase()}: ${reasons.join("; ") || "reduced signal quality"}.`,
    boostUncertainty: degraded,
    constrainAutonomy: degraded,
    requestClarification:
      degraded ||
      influence.highMissingInfoBlocked ||
      influence.highMissingInfoCount > 0,
    reasons,
  };
}

/**
 * Explicit derived-function gating from STATE + BELIEF (not a health engine).
 * Soft-reconciles prior health-gate behavior for safety without treating health as active system.
 */
export function computeAutonomyGate(
  situations: readonly StateSituation[],
  beliefs: readonly BeliefItem[],
): {
  constrainAutonomy: boolean;
  boostUncertainty: boolean;
  requestClarification: boolean;
  band: ExplanationHealthSummary["band"];
  reasons: readonly string[];
} {
  const health = computeHealthSummary(situations, beliefs);
  const influence = computeBeliefInfluence(beliefs);
  return {
    constrainAutonomy: health.constrainAutonomy || influence.highMissingInfoBlocked,
    boostUncertainty: health.boostUncertainty || influence.highMissingInfoBlocked,
    requestClarification: health.requestClarification,
    band: health.band,
    reasons: [
      ...health.reasons,
      ...(influence.highMissingInfoBlocked
        ? ["HIGH missing_information belief blocks irreversible high-confidence decisions"]
        : []),
    ],
  };
}
