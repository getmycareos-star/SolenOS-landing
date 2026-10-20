import type { AssumptionRegistryLayerResult } from "../assumption-registry/types";
import type { ClarificationGateResult } from "../ambiguity-structure-validation/types";
import type { SituationalCareContext } from "../care-context/situational/types";
import type { DocumentIntelligenceLayerResult } from "../document-intelligence/types";
import type { StressNormalizedOutput } from "../input-stress-normalizer/types";
import type {
  MemoryInfluenceEntry,
  MemoryInfluenceState,
  SolenOSMemory,
} from "../memory-influence/types";
import type { MissingInformationQueueLayerResult } from "../missing-information-queue/types";
import type { PriorityEngineLayerResult } from "../priority-engine/types";
import { SYSTEM_HEALTH_DOCUMENT_CONFIDENCE_THRESHOLD } from "./contract-constants";
import type {
  ContextHealth,
  ContradictionHealth,
  DecisionFeedbackSignals,
  DecisionHealth,
  DocumentHealth,
  MemoryHealth,
  MissingInformationHealth,
  SituationHealth,
  SituationSnapshotSignals,
  AssumptionHealth,
} from "./types";

const CRITICAL_DOC_TYPES = new Set([
  "medical_document",
  "insurance_document",
  "benefits_document",
  "legal_document",
  "care_plan",
]);

function collectMemoryEntries(memory: SolenOSMemory): MemoryInfluenceEntry[] {
  return [
    ...memory.identityMemory.entries,
    ...memory.longTermPatternMemory.entries,
    ...memory.operationalMemory.entries,
    ...memory.emotionalMemory.entries,
  ];
}

/**
 * READ adapter — care-context situational + ambiguity clarity (unresolved questions).
 * Does not merge layers.
 */
export function collectContextHealth(params: {
  careContext?: SituationalCareContext;
  clarityGate?: ClarificationGateResult;
  assumptionHealth?: AssumptionHealth;
}): ContextHealth {
  const unresolvedFromContext = params.careContext?.unresolvedItems.length ?? 0;
  const constraints = params.careContext?.activeConstraints ?? [];
  const missingCritical = constraints.filter(
    (c) =>
      /missing|incomplete|unresolved_information|no_time|unknown/i.test(c) ||
      c === "unresolved_information",
  ).length;

  const clarityMissing = params.clarityGate?.clarity.missingDimensions.length ?? 0;
  const unresolvedQuestions =
    unresolvedFromContext +
    clarityMissing +
    (params.clarityGate?.action === "PARTIAL" ? 1 : 0);

  const staleContextItems =
    (params.careContext?.situationType === "uncertain_state" ? 1 : 0) +
    (params.careContext?.environmentSignals.timePressure === "high" &&
    unresolvedFromContext > 0
      ? 1
      : 0) +
    (params.assumptionHealth?.staleAssumptions ?? 0);

  return {
    missingCriticalInformation: missingCritical + (clarityMissing > 0 ? 1 : 0),
    unresolvedQuestions,
    staleContextItems,
  };
}

/**
 * READ adapter — memory influence tags (outdated / incorrect / sensitive conflicts).
 */
export function collectMemoryHealth(state?: MemoryInfluenceState): MemoryHealth {
  if (!state) {
    return { outdatedMemoryCount: 0, correctedMemoryCount: 0, conflictingMemoryCount: 0 };
  }

  const entries = collectMemoryEntries(state.memory);
  const outdatedMemoryCount = entries.filter((e) => e.tags.outdated).length;
  const correctedMemoryCount = entries.filter((e) => e.tags.incorrect).length;

  // Same key appearing with conflicting tags / opposing weights across categories.
  const byKey = new Map<string, MemoryInfluenceEntry[]>();
  for (const entry of entries) {
    if (entry.tags.incorrect) continue;
    const list = byKey.get(entry.key) ?? [];
    list.push(entry);
    byKey.set(entry.key, list);
  }
  let conflictingMemoryCount = 0;
  for (const list of byKey.values()) {
    if (list.length < 2) continue;
    const hasOutdatedAndActive = list.some((e) => e.tags.outdated) && list.some((e) => !e.tags.outdated);
    const weightSpread =
      Math.max(...list.map((e) => e.influenceWeight)) -
      Math.min(...list.map((e) => e.influenceWeight));
    if (hasOutdatedAndActive || weightSpread >= 0.4) {
      conflictingMemoryCount += 1;
    }
  }

  return { outdatedMemoryCount, correctedMemoryCount, conflictingMemoryCount };
}

/**
 * READ adapter — situational unresolved + optional UI / identity situation snapshots.
 */
export function collectSituationHealth(params: {
  careContext?: SituationalCareContext;
  situations?: SituationSnapshotSignals;
}): SituationHealth {
  const fromUi = params.situations;
  if (
    fromUi &&
    (fromUi.activeSituations !== undefined ||
      fromUi.blockedSituations !== undefined ||
      fromUi.unresolvedSituations !== undefined)
  ) {
    return {
      activeSituations: fromUi.activeSituations ?? 0,
      blockedSituations: fromUi.blockedSituations ?? 0,
      unresolvedSituations: fromUi.unresolvedSituations ?? 0,
    };
  }

  const ctx = params.careContext;
  if (!ctx) {
    return { activeSituations: 0, blockedSituations: 0, unresolvedSituations: 0 };
  }

  const unresolved = ctx.unresolvedItems.length;
  const blocked =
    ctx.activeConstraints.filter((c) => /block|stuck|cannot|unable|waiting/i.test(c))
      .length + (ctx.situationType === "uncertain_state" ? 1 : 0);

  return {
    activeSituations: Math.max(1, unresolved > 0 || ctx.activeConstraints.length > 0 ? 1 : 0),
    blockedSituations: blocked,
    unresolvedSituations: unresolved,
  };
}

/**
 * READ adapter — stress contradictions, priority conflicts, document conflicts.
 * Does not resolve contradictions.
 */
export function collectContradictionHealth(params: {
  stressNormalized?: StressNormalizedOutput;
  priorityEngine?: PriorityEngineLayerResult;
  documentIntelligence?: DocumentIntelligenceLayerResult;
  memoryHealth?: MemoryHealth;
}): ContradictionHealth {
  let contradictionsDetected = 0;
  let unresolvedContradictions = 0;

  if (params.stressNormalized?.metadata.has_contradictions) {
    contradictionsDetected += 1;
    unresolvedContradictions += 1;
  }
  if (params.stressNormalized?.detected_tags.includes("CONTRADICTORY_STATEMENTS")) {
    contradictionsDetected += 1;
    unresolvedContradictions += 1;
  }

  const priorityConflicts = params.priorityEngine?.conflicts.length ?? 0;
  contradictionsDetected += priorityConflicts;
  unresolvedContradictions += priorityConflicts;

  const docConflicts = params.documentIntelligence?.memoryLinks.conflictCandidates.length ?? 0;
  contradictionsDetected += docConflicts;
  unresolvedContradictions += docConflicts;

  const memoryConflicts = params.memoryHealth?.conflictingMemoryCount ?? 0;
  contradictionsDetected += memoryConflicts;
  unresolvedContradictions += memoryConflicts;

  return { contradictionsDetected, unresolvedContradictions };
}

/**
 * READ adapter — document intelligence (low confidence < 0.7, unread/stale).
 */
export function collectDocumentHealth(
  documentIntelligence?: DocumentIntelligenceLayerResult,
): DocumentHealth {
  if (!documentIntelligence || documentIntelligence.skipped) {
    return {
      staleDocuments: 0,
      unreadDocuments: 0,
      lowConfidenceExtractions: 0,
      unreadCriticalDocuments: 0,
    };
  }

  const nodes = documentIntelligence.nodes;
  const lowConfidenceExtractions = nodes.filter(
    (n) =>
      n.confidence.overall < SYSTEM_HEALTH_DOCUMENT_CONFIDENCE_THRESHOLD ||
      n.confidence.uncertaintyFlagged,
  ).length;

  // Fresh intake in this turn is treated as unread until acknowledged by user/UI.
  const unreadDocuments = nodes.length;
  const unreadCriticalDocuments = nodes.filter((n) => CRITICAL_DOC_TYPES.has(n.type)).length;

  const staleDocuments = nodes.filter(
    (n) =>
      n.inference.ambiguityFlags.some((f) => /stale|outdated|expired/i.test(f)) ||
      (n.confidence.overall < SYSTEM_HEALTH_DOCUMENT_CONFIDENCE_THRESHOLD &&
        n.extracted.timestamps.length === 0),
  ).length;

  return {
    staleDocuments,
    unreadDocuments,
    lowConfidenceExtractions,
    unreadCriticalDocuments,
  };
}

export function collectDecisionHealth(
  feedback?: DecisionFeedbackSignals,
): DecisionHealth {
  return {
    acceptedRecommendations: feedback?.acceptedRecommendations ?? 0,
    rejectedRecommendations: feedback?.rejectedRecommendations ?? 0,
    overriddenRecommendations: feedback?.overriddenRecommendations ?? 0,
  };
}

/**
 * READ adapter — assumption registry health (stale / expired / invalidated counts).
 */
export function collectAssumptionHealth(
  assumptionRegistryLayer?: AssumptionRegistryLayerResult,
): AssumptionHealth {
  if (!assumptionRegistryLayer) {
    return {
      activeAssumptions: 0,
      expiredAssumptions: 0,
      invalidatedAssumptions: 0,
      staleAssumptions: 0,
    };
  }
  return assumptionRegistryLayer.envelope.health;
}

/**
 * READ adapter — missing information queue health (open / high-priority / resolved).
 */
export function collectMissingInformationHealth(
  missingInformationQueueLayer?: MissingInformationQueueLayerResult,
): MissingInformationHealth {
  if (!missingInformationQueueLayer) {
    return { openItems: 0, highPriorityItems: 0, resolvedItems: 0 };
  }
  return missingInformationQueueLayer.envelope.health;
}
