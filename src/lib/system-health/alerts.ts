import {
  REJECTION_DRIFT_MIN_SAMPLES,
  REJECTION_DRIFT_RATIO_THRESHOLD,
  SITUATION_LOAD_HIGH_THRESHOLD,
} from "./contract-constants";
import type {
  HealthAlert,
  HealthBand,
  SystemHealth,
} from "./types";

function plural(n: number, singular: string, pluralForm?: string): string {
  return n === 1 ? singular : (pluralForm ?? `${singular}s`);
}

/**
 * Generate user-attention alerts from readiness signals.
 * Plain language — not analytics.
 */
export function generateHealthAlerts(
  health: SystemHealth,
  band: HealthBand,
): HealthAlert[] {
  const alerts: HealthAlert[] = [];

  if (health.contextQuality.missingCriticalInformation > 0) {
    alerts.push({
      severity: health.contextQuality.missingCriticalInformation >= 2 ? "HIGH" : "MEDIUM",
      title: "Critical context missing",
      explanation: `${health.contextQuality.missingCriticalInformation} ${plural(
        health.contextQuality.missingCriticalInformation,
        "critical information gap",
        "critical information gaps",
      )} reduce recommendation readiness.`,
      recommendedAction: "Ask the caregiver for the missing details before recommending.",
    });
  }

  if (health.contextQuality.unresolvedQuestions > 0) {
    alerts.push({
      severity: "MEDIUM",
      title: "Unresolved questions",
      explanation: `${health.contextQuality.unresolvedQuestions} ${plural(
        health.contextQuality.unresolvedQuestions,
        "question remains",
        "questions remain",
      )} open.`,
      recommendedAction: "Surface clarification questions before committing to an action.",
    });
  }

  if (health.memoryQuality.outdatedMemoryCount > 0) {
    alerts.push({
      severity: "MEDIUM",
      title: "Outdated memory influence",
      explanation: `${health.memoryQuality.outdatedMemoryCount} outdated ${plural(
        health.memoryQuality.outdatedMemoryCount,
        "memory signal",
      )} still in play.`,
      recommendedAction: "Tag or forget outdated memory before weighting recommendations.",
    });
  }

  if (health.memoryQuality.conflictingMemoryCount > 0) {
    alerts.push({
      severity: "HIGH",
      title: "Conflicting memory",
      explanation: `${health.memoryQuality.conflictingMemoryCount} ${plural(
        health.memoryQuality.conflictingMemoryCount,
        "memory conflict",
      )} detected.`,
      recommendedAction: "Resolve memory conflicts or reduce memory influence weight.",
    });
  }

  if (health.situationCoverage.activeSituations >= SITUATION_LOAD_HIGH_THRESHOLD) {
    alerts.push({
      severity: "HIGH",
      title: "Situation Load High",
      explanation: `${health.situationCoverage.activeSituations} active situations increase cognitive load and error risk.`,
      recommendedAction: "Narrow to the highest-priority situation before recommending.",
    });
  }

  if (health.situationCoverage.unresolvedSituations > 0) {
    alerts.push({
      severity:
        health.situationCoverage.unresolvedSituations >= 2 ? "HIGH" : "MEDIUM",
      title: "Unresolved caregiving situations",
      explanation: `${health.situationCoverage.unresolvedSituations} unresolved ${plural(
        health.situationCoverage.unresolvedSituations,
        "caregiving situation",
      )}.`,
      recommendedAction: "Close or clarify unresolved situations before expanding recommendations.",
    });
  }

  if (health.situationCoverage.blockedSituations > 0) {
    alerts.push({
      severity: "MEDIUM",
      title: "Blocked situations",
      explanation: `${health.situationCoverage.blockedSituations} ${plural(
        health.situationCoverage.blockedSituations,
        "situation is",
        "situations are",
      )} blocked.`,
      recommendedAction: "Identify the blocking constraint and ask for a way forward.",
    });
  }

  if (health.contradictionHealth.unresolvedContradictions > 0) {
    alerts.push({
      severity: "HIGH",
      title: "Unresolved contradictions",
      explanation: `${health.contradictionHealth.unresolvedContradictions} unresolved ${plural(
        health.contradictionHealth.unresolvedContradictions,
        "contradiction",
      )} reduce trust in recommendations.`,
      recommendedAction: "Clarify contradictory signals before acting on them.",
    });
  } else if (health.contradictionHealth.contradictionsDetected > 0) {
    alerts.push({
      severity: "MEDIUM",
      title: "Contradictions detected",
      explanation: `${health.contradictionHealth.contradictionsDetected} ${plural(
        health.contradictionHealth.contradictionsDetected,
        "contradiction was",
        "contradictions were",
      )} detected.`,
      recommendedAction: "Treat contradictory inputs as open until reconciled.",
    });
  }

  if (health.documentHealth.unreadCriticalDocuments > 0) {
    alerts.push({
      severity: "HIGH",
      title: "Unread critical documents",
      explanation: `${health.documentHealth.unreadCriticalDocuments} unread critical ${plural(
        health.documentHealth.unreadCriticalDocuments,
        "document",
      )} (medical/insurance/benefits).`,
      recommendedAction: "Review critical documents before recommending care or coverage actions.",
    });
  } else if (health.documentHealth.unreadDocuments > 0) {
    alerts.push({
      severity: "MEDIUM",
      title: "Unread documents",
      explanation: `${health.documentHealth.unreadDocuments} ${plural(
        health.documentHealth.unreadDocuments,
        "document remains",
        "documents remain",
      )} unread.`,
      recommendedAction: "Acknowledge document contents before relying on extractions.",
    });
  }

  if (health.documentHealth.lowConfidenceExtractions > 0) {
    alerts.push({
      severity: "MEDIUM",
      title: "Low-confidence document extractions",
      explanation: `${health.documentHealth.lowConfidenceExtractions} extraction(s) below confidence 0.7.`,
      recommendedAction: "Do not treat low-confidence extractions as decision facts.",
    });
  }

  if (health.documentHealth.staleDocuments > 0) {
    alerts.push({
      severity: "LOW",
      title: "Stale documents",
      explanation: `${health.documentHealth.staleDocuments} ${plural(
        health.documentHealth.staleDocuments,
        "document may be",
        "documents may be",
      )} stale.`,
      recommendedAction: "Confirm document currency with the caregiver.",
    });
  }

  if (health.assumptionQuality.staleAssumptions > 0) {
    alerts.push({
      severity: health.assumptionQuality.staleAssumptions >= 3 ? "HIGH" : "MEDIUM",
      title: "Stale assumptions",
      explanation: `${health.assumptionQuality.staleAssumptions} active ${plural(
        health.assumptionQuality.staleAssumptions,
        "assumption has",
        "assumptions have",
      )} not been verified recently. Decision quality may be reduced.`,
      recommendedAction: "Validate or invalidate stale assumptions before relying on them.",
    });
  }

  if (health.assumptionQuality.invalidatedAssumptions > 0) {
    alerts.push({
      severity: "LOW",
      title: "Recently invalidated assumptions",
      explanation: `${health.assumptionQuality.invalidatedAssumptions} ${plural(
        health.assumptionQuality.invalidatedAssumptions,
        "assumption was",
        "assumptions were",
      )} invalidated by contradictory evidence.`,
      recommendedAction: "Review invalidated assumptions — they no longer influence decisions.",
    });
  }

  if (health.missingInformationQuality.highPriorityItems > 0) {
    alerts.push({
      severity: "HIGH",
      title: "Reasoning Quality Impact",
      explanation:
        "Critical information gaps are limiting recommendation quality.",
      recommendedAction:
        "Clarify high-priority missing knowledge before trusting recommendations.",
    });
  } else if (health.missingInformationQuality.openItems > 0) {
    alerts.push({
      severity: "MEDIUM",
      title: "Information gaps open",
      explanation: `${health.missingInformationQuality.openItems} ${plural(
        health.missingInformationQuality.openItems,
        "knowledge gap remains",
        "knowledge gaps remain",
      )} open.`,
      recommendedAction: "Surface missing knowledge questions in the situation view.",
    });
  }

  const totalFeedback =
    health.decisionHealth.acceptedRecommendations +
    health.decisionHealth.rejectedRecommendations +
    health.decisionHealth.overriddenRecommendations;
  if (totalFeedback >= REJECTION_DRIFT_MIN_SAMPLES) {
    const rejectRatio =
      (health.decisionHealth.rejectedRecommendations +
        health.decisionHealth.overriddenRecommendations * 0.5) /
      totalFeedback;
    if (rejectRatio >= REJECTION_DRIFT_RATIO_THRESHOLD) {
      alerts.push({
        severity: "HIGH",
        title: "Repeated recommendation rejection",
        explanation:
          "High rejection/override rate may indicate model drift or context gaps.",
        recommendedAction:
          "Increase clarification, reduce autonomy, and re-check context completeness.",
      });
    }
  }

  if (band === "Unreliable") {
    alerts.push({
      severity: "HIGH",
      title: "Decision readiness unreliable",
      explanation: "Overall system health is below the reliable recommendation threshold.",
      recommendedAction: "Request clarification and avoid autonomous recommendations.",
    });
  } else if (band === "Degraded") {
    alerts.push({
      severity: "MEDIUM",
      title: "Decision readiness degraded",
      explanation: "System health is degraded — recommendations should be constrained.",
      recommendedAction: "Reduce autonomy and surface uncertainty until health recovers.",
    });
  }

  return alerts;
}

/**
 * Short user-facing bullets for the sidebar — no charts.
 */
export function buildIssueBullets(health: SystemHealth, alerts: readonly HealthAlert[]): string[] {
  const bullets: string[] = [];

  for (const item of health.contextQuality.missingCriticalInformation > 0
    ? [`Missing critical information (${health.contextQuality.missingCriticalInformation})`]
    : []) {
    bullets.push(item);
  }

  if (health.documentHealth.unreadCriticalDocuments === 1) {
    bullets.push("One critical document unread");
  } else if (health.documentHealth.unreadCriticalDocuments > 1) {
    bullets.push(
      `${health.documentHealth.unreadCriticalDocuments} critical documents unread`,
    );
  } else if (health.documentHealth.unreadDocuments === 1) {
    bullets.push("One document unread");
  } else if (health.documentHealth.unreadDocuments > 1) {
    bullets.push(`${health.documentHealth.unreadDocuments} documents unread`);
  }

  if (health.situationCoverage.unresolvedSituations === 1) {
    bullets.push("One unresolved caregiving situation");
  } else if (health.situationCoverage.unresolvedSituations > 1) {
    bullets.push(
      `${health.situationCoverage.unresolvedSituations} unresolved caregiving situations`,
    );
  }

  if (health.situationCoverage.activeSituations >= SITUATION_LOAD_HIGH_THRESHOLD) {
    bullets.push("Situation Load High");
  }

  if (health.contradictionHealth.unresolvedContradictions > 0) {
    bullets.push(
      `${health.contradictionHealth.unresolvedContradictions} unresolved contradiction${
        health.contradictionHealth.unresolvedContradictions === 1 ? "" : "s"
      }`,
    );
  }

  if (health.memoryQuality.outdatedMemoryCount > 0) {
    bullets.push(
      `${health.memoryQuality.outdatedMemoryCount} outdated memory signal${
        health.memoryQuality.outdatedMemoryCount === 1 ? "" : "s"
      }`,
    );
  }

  if (health.assumptionQuality.staleAssumptions > 0) {
    bullets.push(
      `${health.assumptionQuality.staleAssumptions} stale assumption${
        health.assumptionQuality.staleAssumptions === 1 ? "" : "s"
      }`,
    );
  }

  if (health.missingInformationQuality.highPriorityItems > 0) {
    bullets.push(
      `${health.missingInformationQuality.highPriorityItems} high-priority information gap${
        health.missingInformationQuality.highPriorityItems === 1 ? "" : "s"
      }`,
    );
  } else if (health.missingInformationQuality.openItems > 0) {
    bullets.push(
      `${health.missingInformationQuality.openItems} open information gap${
        health.missingInformationQuality.openItems === 1 ? "" : "s"
      }`,
    );
  }

  // Fallback to alert titles when no specific bullets yet.
  if (bullets.length === 0) {
    for (const alert of alerts.slice(0, 3)) {
      if (alert.severity === "HIGH" || alert.severity === "MEDIUM") {
        bullets.push(alert.title);
      }
    }
  }

  return bullets.slice(0, 5);
}

export function formatUserFacingSummary(
  band: HealthBand,
  overallHealthScore: number,
  issueBullets: readonly string[],
): string {
  const header = `System Health: ${band} (${overallHealthScore})`;
  if (issueBullets.length === 0) {
    return `${header}\nIssues Requiring Attention:\n• None`;
  }
  const lines = issueBullets.map((b) => `• ${b}`).join("\n");
  return `${header}\nIssues Requiring Attention:\n${lines}`;
}
