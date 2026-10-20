import type { AssumptionRegistryLayerResult } from "../assumption-registry/types";
import type { ClarificationGateResult } from "../ambiguity-structure-validation/types";
import type { CareContextLayerResult } from "../care-context/situational/types";
import type { DocumentIntelligenceLayerResult } from "../document-intelligence/types";
import type { StressNormalizedOutput } from "../input-stress-normalizer/types";
import type { MemoryInfluenceLayerResult } from "../memory-influence/types";
import type { MissingInformationQueueLayerResult } from "../missing-information-queue/types";
import type { PriorityEngineLayerResult } from "../priority-engine/types";
import type {
  DecisionAuthorityLevel,
  GovernanceApplicationResult,
} from "../settings-governance/types";
import {
  buildIssueBullets,
  formatUserFacingSummary,
  generateHealthAlerts,
} from "./alerts";
import {
  collectContextHealth,
  collectContradictionHealth,
  collectDecisionHealth,
  collectDocumentHealth,
  collectMemoryHealth,
  collectAssumptionHealth,
  collectMissingInformationHealth,
  collectSituationHealth,
} from "./collectors";
import {
  CLARIFICATION_REQUEST_PREFIX,
  HEALTH_UNCERTAINTY_MARKER,
} from "./contract-constants";
import { buildPreRecommendationGate } from "./gate";
import { runSystemHealthGuarantee } from "./guarantee";
import { buildSystemHealth } from "./score";
import type {
  DecisionFeedbackSignals,
  SituationSnapshotSignals,
  SystemHealthLayerPayload,
  SystemHealthLayerResult,
} from "./types";

export type ProcessSystemHealthLayerParams = {
  careContextLayer?: CareContextLayerResult;
  memoryInfluenceLayer?: MemoryInfluenceLayerResult;
  assumptionRegistryLayer?: AssumptionRegistryLayerResult;
  missingInformationQueueLayer?: MissingInformationQueueLayerResult;
  documentIntelligence?: DocumentIntelligenceLayerResult;
  priorityEngineLayer?: PriorityEngineLayerResult;
  stressNormalized?: StressNormalizedOutput;
  clarityGate?: ClarificationGateResult;
  situations?: SituationSnapshotSignals;
  decisionFeedback?: DecisionFeedbackSignals;
  currentAutonomy?: DecisionAuthorityLevel;
};

/**
 * SYSTEM HEALTH LAYER — compute readiness from upstream signal adapters (READ only).
 */
export function processSystemHealthLayer(
  params: ProcessSystemHealthLayerParams = {},
): SystemHealthLayerResult {
  const assumptionQuality = collectAssumptionHealth(params.assumptionRegistryLayer);
  const missingInformationQuality = collectMissingInformationHealth(
    params.missingInformationQueueLayer,
  );
  const contextQuality = collectContextHealth({
    careContext: params.careContextLayer?.context,
    clarityGate: params.clarityGate,
    assumptionHealth: assumptionQuality,
  });
  // High-priority MI gaps count as critical context missing.
  if (missingInformationQuality.highPriorityItems > 0) {
    contextQuality.missingCriticalInformation +=
      missingInformationQuality.highPriorityItems;
  }
  if (missingInformationQuality.openItems > 0) {
    contextQuality.unresolvedQuestions += missingInformationQuality.openItems;
  }
  const memoryQuality = collectMemoryHealth(params.memoryInfluenceLayer?.state);
  const situationCoverage = collectSituationHealth({
    careContext: params.careContextLayer?.context,
    situations: params.situations,
  });
  const documentHealth = collectDocumentHealth(params.documentIntelligence);
  const decisionHealth = collectDecisionHealth(params.decisionFeedback);
  const contradictionHealth = collectContradictionHealth({
    stressNormalized: params.stressNormalized,
    priorityEngine: params.priorityEngineLayer,
    documentIntelligence: params.documentIntelligence,
    memoryHealth: memoryQuality,
  });

  const { health, dimensionScores, band } = buildSystemHealth({
    contextQuality,
    memoryQuality,
    situationCoverage,
    contradictionHealth,
    documentHealth,
    decisionHealth,
    assumptionQuality,
    missingInformationQuality,
  });

  const guarantee = runSystemHealthGuarantee({
    health,
    contextChecked: true,
    memoryChecked: true,
    contradictionsChecked: true,
    criticalDocumentsChecked: true,
    band,
  });

  const alerts = generateHealthAlerts(health, band);
  const issueBullets = buildIssueBullets(health, alerts);
  const userFacingSummary = formatUserFacingSummary(
    band,
    health.overallHealthScore,
    issueBullets,
  );

  const gate = buildPreRecommendationGate({
    band,
    health,
    guarantee,
    currentAutonomy: params.currentAutonomy,
  });

  return {
    health,
    band,
    dimensionScores,
    alerts,
    gate,
    guarantee,
    userFacingSummary,
    issueBullets,
  };
}

export function toSystemHealthLayerPayload(
  layer: SystemHealthLayerResult,
): SystemHealthLayerPayload {
  return {
    overallHealthScore: layer.health.overallHealthScore,
    band: layer.band,
    alerts: layer.alerts,
    issueBullets: layer.issueBullets,
    userFacingSummary: layer.userFacingSummary,
    gate: {
      constrainAutonomy: layer.gate.constrainAutonomy,
      boostUncertainty: layer.gate.boostUncertainty,
      requestClarification: layer.gate.requestClarification,
      autonomyLevel: layer.gate.autonomyLevel,
    },
    dimensionScores: layer.dimensionScores,
    health: layer.health,
  };
}

/**
 * Apply degraded-health constraints onto governed output:
 * reduce autonomy, boost uncertainty, request clarification.
 */
export function applySystemHealthGovernanceWeighting(
  governance: GovernanceApplicationResult,
  layer: SystemHealthLayerResult,
): GovernanceApplicationResult {
  const gate = layer.gate;
  let response = { ...governance.response };
  const appliedConstraints = [...governance.appliedConstraints];
  let routing = { ...governance.routing };

  if (gate.constrainAutonomy) {
    routing = {
      ...routing,
      decisionAutonomy: gate.autonomyLevel,
      inferenceDepth:
        layer.band === "Unreliable"
          ? "shallow"
          : routing.inferenceDepth === "deep"
            ? "standard"
            : routing.inferenceDepth,
    };
    appliedConstraints.push({
      kind: "system_health_gate",
      detail: `constrainAutonomy→${gate.autonomyLevel} band=${layer.band} score=${layer.health.overallHealthScore}`,
    });
  }

  if (gate.boostUncertainty) {
    routing = {
      ...routing,
      transparencyRouting: {
        ...routing.transparencyRouting,
        uncertaintyDisplay: true,
        confidenceDisplay: false,
      },
    };
    if (!response.what_matters_now.includes(HEALTH_UNCERTAINTY_MARKER)) {
      response = {
        ...response,
        what_matters_now: `${response.what_matters_now} ${HEALTH_UNCERTAINTY_MARKER}`.trim(),
      };
    }
    appliedConstraints.push({
      kind: "system_health_gate",
      detail: `boostUncertainty band=${layer.band}`,
    });
  }

  if (gate.requestClarification) {
    if (!response.what_to_ask_next.startsWith(CLARIFICATION_REQUEST_PREFIX)) {
      response = {
        ...response,
        what_to_ask_next: CLARIFICATION_REQUEST_PREFIX + response.what_to_ask_next,
      };
    }
    appliedConstraints.push({
      kind: "system_health_gate",
      detail: `requestClarification reasons=${gate.reasons.join("; ") || "degraded readiness"}`,
    });
  }

  appliedConstraints.push({
    kind: "system_health_gate",
    detail: `readiness score=${layer.health.overallHealthScore} band=${layer.band}`,
  });

  return {
    ...governance,
    response,
    routing,
    moduleWeights: {
      ...governance.moduleWeights,
      safety: Math.min(
        2,
        governance.moduleWeights.safety *
          (gate.constrainAutonomy ? (layer.band === "Unreliable" ? 1.35 : 1.2) : 1),
      ),
      priority: Math.max(
        0.3,
        governance.moduleWeights.priority *
          (gate.constrainAutonomy ? (layer.band === "Unreliable" ? 0.7 : 0.85) : 1),
      ),
    },
    appliedConstraints,
  };
}
