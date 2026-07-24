import type { SystemHealthView } from "../ui-runtime/types";
import type {
  HealthBand,
  HealthAlert,
  SystemHealth,
  SystemHealthLayerPayload,
  SystemHealthLayerResult,
} from "./types";
import { formatUserFacingSummary } from "./alerts";

/**
 * View-model for UI sidebar `system_health` — plain status text, not a dashboard.
 */
export type SystemHealthSidebarView = {
  band: HealthBand;
  overallHealthScore: number;
  summaryLine: string;
  issueBullets: readonly string[];
  fullText: string;
  alerts: readonly HealthAlert[];
  gateActive: boolean;
};

export function toSystemHealthSidebarView(
  layer: SystemHealthLayerResult | SystemHealthLayerPayload,
): SystemHealthSidebarView {
  const score =
    "overallHealthScore" in layer && typeof layer.overallHealthScore === "number"
      ? layer.overallHealthScore
      : "health" in layer
        ? layer.health.overallHealthScore
        : 0;
  const band = layer.band;
  const issueBullets = layer.issueBullets;
  const fullText =
    "userFacingSummary" in layer && layer.userFacingSummary
      ? layer.userFacingSummary
      : formatUserFacingSummary(band, score, issueBullets);

  return {
    band,
    overallHealthScore: score,
    summaryLine: `System Health: ${band} (${score})`,
    issueBullets,
    fullText,
    alerts: layer.alerts,
    gateActive:
      layer.gate.constrainAutonomy ||
      layer.gate.boostUncertainty ||
      layer.gate.requestClarification,
  };
}

/** Bridge into existing ui-runtime SystemHealthView shape. */
export function toUiRuntimeSystemHealthView(
  layer: SystemHealthLayerResult | SystemHealthLayerPayload,
): SystemHealthView {
  const health = "health" in layer ? layer.health : undefined;
  return {
    confidenceDrift: layer.band === "Strong" || layer.band === "Stable" ? "stable" : "elevated",
    contextCompleteness:
      !health || health.contextQuality.missingCriticalInformation === 0
        ? health && health.contextQuality.unresolvedQuestions === 0
          ? "adequate"
          : "partial"
        : "incomplete",
    memoryQuality:
      !health ||
      (health.memoryQuality.outdatedMemoryCount === 0 &&
        health.memoryQuality.conflictingMemoryCount === 0)
        ? "good"
        : "attention_needed",
    contradictionCount: health?.contradictionHealth.unresolvedContradictions ?? 0,
    staleDocuments: health?.documentHealth.staleDocuments ?? 0,
    unresolvedQuestions: health?.contextQuality.unresolvedQuestions ?? 0,
    source: "derived",
  };
}

export function emptySystemHealthParts(): Omit<SystemHealth, "overallHealthScore"> {
  return {
    contextQuality: {
      missingCriticalInformation: 0,
      unresolvedQuestions: 0,
      staleContextItems: 0,
    },
    memoryQuality: {
      outdatedMemoryCount: 0,
      correctedMemoryCount: 0,
      conflictingMemoryCount: 0,
    },
    situationCoverage: {
      activeSituations: 0,
      blockedSituations: 0,
      unresolvedSituations: 0,
    },
    contradictionHealth: {
      contradictionsDetected: 0,
      unresolvedContradictions: 0,
    },
    documentHealth: {
      staleDocuments: 0,
      unreadDocuments: 0,
      lowConfidenceExtractions: 0,
      unreadCriticalDocuments: 0,
    },
    decisionHealth: {
      acceptedRecommendations: 0,
      rejectedRecommendations: 0,
      overriddenRecommendations: 0,
    },
    assumptionQuality: {
      activeAssumptions: 0,
      expiredAssumptions: 0,
      invalidatedAssumptions: 0,
      staleAssumptions: 0,
    },
    missingInformationQuality: {
      openItems: 0,
      highPriorityItems: 0,
      resolvedItems: 0,
    },
  };
}
