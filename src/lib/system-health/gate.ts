import type { DecisionAuthorityLevel } from "../settings-governance/types-derived";
import type {
  HealthBand,
  PreRecommendationGate,
  SystemHealth,
  SystemHealthGuaranteeResult,
} from "./types";

function reduceAutonomy(
  current: DecisionAuthorityLevel,
  steps: number,
): DecisionAuthorityLevel {
  const order: DecisionAuthorityLevel[] = ["HIGH", "MEDIUM", "LOW"];
  const idx = order.indexOf(current);
  const next = Math.min(order.length - 1, Math.max(0, idx + steps));
  return order[next]!;
}

/**
 * Pre-recommendation gate — derived-function behavior over readiness signals.
 * Soft-reconciled with computeAutonomyGate(STATE, BELIEF) in analyze-pipeline.
 * Health is an EXPLANATION summary; this is NOT an independent Health Engine.
 * When Degraded/Unreliable: reduce autonomy, boost uncertainty, request clarification.
 */
export function buildPreRecommendationGate(params: {
  band: HealthBand;
  health: SystemHealth;
  guarantee: SystemHealthGuaranteeResult;
  currentAutonomy?: DecisionAuthorityLevel;
}): PreRecommendationGate {
  const degraded = params.band === "Degraded" || params.band === "Unreliable";
  const reasons: string[] = [];

  if (params.band === "Unreliable") {
    reasons.push("overall health Unreliable");
  } else if (params.band === "Degraded") {
    reasons.push("overall health Degraded");
  }

  if (params.health.contradictionHealth.unresolvedContradictions > 0) {
    reasons.push("unresolved contradictions");
  }
  if (params.health.documentHealth.unreadCriticalDocuments > 0) {
    reasons.push("unread critical documents");
  }
  if (params.health.contextQuality.missingCriticalInformation > 0) {
    reasons.push("missing critical information");
  }
  if (params.health.missingInformationQuality.highPriorityItems > 0) {
    reasons.push("high-priority missing information gaps");
  }
  if (!params.guarantee.ok) {
    reasons.push(...params.guarantee.violations);
  }

  const forceClarify =
    degraded ||
    params.health.contradictionHealth.unresolvedContradictions > 0 ||
    params.health.documentHealth.unreadCriticalDocuments > 0 ||
    params.health.contextQuality.missingCriticalInformation >= 2 ||
    params.health.missingInformationQuality.highPriorityItems > 0;

  const steps = params.band === "Unreliable" ? 2 : params.band === "Degraded" ? 1 : 0;
  const autonomyLevel = degraded
    ? reduceAutonomy(params.currentAutonomy ?? "MEDIUM", steps)
    : (params.currentAutonomy ?? "MEDIUM");

  return {
    constrainAutonomy: degraded,
    boostUncertainty: degraded,
    requestClarification: forceClarify,
    autonomyLevel,
    reasons,
  };
}
