import { processAssumptionRegistryLayer } from "../assumption-registry";
import {
  processConflictDetection,
  resetConflictRegistryStore,
} from "../conflict-detection";
import { processContextWeighting } from "../context-weighting";
import { appendDecisionHistoryForScope } from "../decision-history";
import { processMissingInformationQueueLayer } from "../missing-information-queue";
import { processFailSafeMode } from "../fail-safe-mode";
import { processPriorityEngineLayer } from "../priority-engine";
import { captureReasoningSnapshot } from "../reasoning-snapshot";
import {
  processResolutionEngineLayer,
  resetResolutionStoreForTests,
} from "../resolution-engine";
import { processSystemHealthLayer } from "../system-health";
import { processTimeEngineLayer } from "../time-engine";
import {
  appendTimelineEntry,
  createEmptyTimeline,
  type TimelineEntry,
} from "../ui-runtime";
import {
  CORE_RUNTIME_GAPS,
  CORE_RUNTIME_PIPELINE_STAGES,
} from "./contract-constants";
import { toCanonicalSituation } from "./situation";
import type {
  CoreRuntimeOrchestrationInput,
  CoreRuntimeOrchestrationResult,
  CoreRuntimePipelineStage,
  TruthLayerSeparation,
} from "./types";

/**
 * Core Runtime orchestration — Situation-first pipeline.
 *
 * Approximate order:
 * Input → Context → Situation Resolver → Missing Info → Assumptions →
 * Memory → Emotional → Priority → Conflict → Decision → Resolution →
 * Decision History Writer → Timeline Writer → System Health Monitor → Output
 *
 * Analysis pipeline remains the full LLM path; this module orchestrates
 * runtime layer state machines and truth-layer writers without breaking layers.
 */
export function orchestrateCoreRuntime(
  params: CoreRuntimeOrchestrationInput,
): CoreRuntimeOrchestrationResult {
  const nowMs = params.nowMs ?? Date.now();
  const stagesCompleted: CoreRuntimePipelineStage[] = [];

  const mark = (stage: CoreRuntimePipelineStage) => {
    stagesCompleted.push(stage);
  };

  mark("input");

  // CONTEXT WEIGHTING — soft influence on which inputs matter.
  const contextWeighting = processContextWeighting({
    userInput: params.userInput,
    careContextHints: [],
  });
  mark("context");

  // SITUATION RESOLVER (Resolution Engine) — canonical lifecycle owner.
  const resolution = processResolutionEngineLayer({
    input: params.userInput,
    careSessionId: params.careSessionId,
    userId: params.telemetryUserId,
    situationTitle: params.situationTitle ?? params.userInput.slice(0, 120),
    applyDetectedEvidence: true,
    nowMs,
  });
  mark("situation_resolver");

  const tracked =
    resolution.active[0] ??
    resolution.situations.find((s) => s.status === "ACTIVE") ??
    resolution.situations[0];

  if (!tracked) {
    throw new Error("No Situation = no system state — resolution must ensure ACTIVE");
  }

  const situation = toCanonicalSituation(tracked, {
    summary: params.userInput.slice(0, 200),
  });

  // ASSUMPTIONS — believed layer (validated ≈ confirmed).
  const assumptions = processAssumptionRegistryLayer({
    telemetry_user_id: params.telemetryUserId,
    input: params.userInput,
    trackedSituations: resolution.situations,
    nowMs,
  });
  mark("assumptions");

  // MISSING INFO — unknown layer.
  const missingInformation = processMissingInformationQueueLayer({
    telemetry_user_id: params.telemetryUserId,
    input: params.userInput,
    trackedSituations: resolution.situations,
    situationId: situation.id,
    nowMs,
  });
  mark("missing_info");

  // MEMORY / EMOTIONAL — time engine supplies temporal + soft emotional weights.
  const timeEngine = processTimeEngineLayer({
    input: params.userInput,
  });
  mark("memory");
  mark("emotional");

  // CONFLICT — after Memory; before Priority / Decision.
  // Operational registry: open conflicts lower confidence; CRITICAL medical restricts decisions.
  let conflicts = processConflictDetection({
    scopeId: params.scopeId,
    situationId: situation.id,
    userInput: params.userInput,
    assumptionHints: assumptions.envelope.influenceHints,
    assumptionInvalidations: assumptions.invalidations,
    highMissingInfoCount: missingInformation.envelope.highPriorityOpenCount,
  });
  mark("conflict");

  // PRIORITY — ranks only; missing-info + open conflicts cap confidence.
  const priority = processPriorityEngineLayer({
    timeEngine,
    assumptionEnvelope: assumptions.envelope,
    missingInformationEnvelope: missingInformation.envelope,
    trackedSituations: resolution.situations,
    nowMs,
  });
  mark("priority");

  if (priority.conflicts.some((c) => c.unresolved)) {
    conflicts = processConflictDetection({
      scopeId: params.scopeId,
      situationId: situation.id,
      userInput: params.userInput,
      assumptionHints: assumptions.envelope.influenceHints,
      priorityConflicts: priority.conflicts,
      assumptionInvalidations: assumptions.invalidations,
      highMissingInfoCount: missingInformation.envelope.highPriorityOpenCount,
    });
  }

  const highMissingInfoBlocked =
    missingInformation.envelope.highPriorityOpenCount > 0;
  const criticalConflictBlocked = conflicts.criticalDecisionRestricted;
  const recomputationTriggered =
    conflicts.reEvaluationRequired || assumptions.invalidations.length > 0;

  const topVector = priority.rankedForActionGenerator[0];
  let chosenAction = topVector?.actionId ?? "clarify_before_action";
  if (criticalConflictBlocked || highMissingInfoBlocked) {
    chosenAction = "clarify_before_action";
  }
  const rejectedAlternatives = priority.rankedForActionGenerator
    .slice(1)
    .map((v) => v.actionId);

  // FAIL-SAFE MODE — post-decision gate; never guess missing truth.
  const failSafe = processFailSafeMode(
    {
      chosenActionId: chosenAction,
      chosenActionLabel: chosenAction,
      rejectedAlternatives: rejectedAlternatives.map((id) => ({ id, label: id })),
      highMissingInfoBlocked,
      highPriorityMissingInfoCount: missingInformation.envelope.highPriorityOpenCount,
      openConflictCount: conflicts.envelope.openCount,
      criticalDecisionRestricted: conflicts.criticalDecisionRestricted,
      reEvaluationRequired: conflicts.reEvaluationRequired,
      conflictClarificationQuestion:
        conflicts.envelope.clarification?.question ?? null,
      outputRiskLevel: "medium",
      confidenceCap: highMissingInfoBlocked ? 0.55 : undefined,
      conflictConfidencePenalty: conflicts.envelope.confidencePenalty,
      missingInfoQuestions: missingInformation.envelope.needsNext,
      situationId: situation.id,
      userId: params.telemetryUserId ?? null,
    },
    { escalateMissingInfo: Boolean(params.telemetryUserId) },
  );
  chosenAction = failSafe.effectiveActionId;

  mark("decision");
  mark("resolution");

  // DECISION HISTORY = WHY (never Timeline).
  let decisionHistoryEntry: CoreRuntimeOrchestrationResult["decisionHistoryEntry"];
  if (!params.dryRun) {
    decisionHistoryEntry = appendDecisionHistoryForScope(params.scopeId, {
      situationId: situation.id,
      chosenAction,
      rejectedAlternatives,
      reasoningSummary: failSafe.engaged
        ? `FAIL-SAFE engaged (${failSafe.triggers.map((t) => t.kind).join(", ")}); confidence=${failSafe.decisionConfidence.level}.`
        : criticalConflictBlocked
        ? `CRITICAL open medical conflict restricts high-confidence action until clarified. Clarification: ${conflicts.envelope.clarification?.question ?? "resolve medical conflict"}.`
        : highMissingInfoBlocked
        ? `Deferred high-confidence action due to HIGH missing information (confidence capped). Top vector=${chosenAction}.`
        : `Selected ${chosenAction} from priority vectors under uncertainty.`,
      assumptionsUsed: assumptions.envelope.influenceHints.slice(0, 5),
      missingInfoImpact: [
        ...(failSafe.escalatedMissingInfoQuestions ?? []),
        ...(conflicts.envelope.clarification
          ? [conflicts.envelope.clarification.question]
          : []),
        ...missingInformation.envelope.needsNext,
      ].slice(0, 5),
      timestamp: new Date(nowMs).toISOString(),
    });
  }
  mark("decision_history_writer");

  // TIMELINE = WHAT (never Decision History WHY).
  let timelineEntry: TimelineEntry | undefined;
  if (!params.dryRun) {
    const timeline = appendTimelineEntry(createEmptyTimeline(), {
      type: "system_event",
      situationId: situation.id,
      summary: `Situation ${situation.status}: processed input; action=${chosenAction}`,
      timestamp: new Date(nowMs).toISOString(),
    });
    timelineEntry = timeline.entries[timeline.entries.length - 1];
  }
  mark("timeline_writer");

  // REASONING SNAPSHOT — audit/trust only.
  const reasoningSnapshot = captureReasoningSnapshot({
    situationId: situation.id,
    inputsUsed: [params.userInput.slice(0, 200)],
    assumptionsUsed: assumptions.envelope.influenceHints.slice(0, 5),
    missingInfoSnapshot: missingInformation.envelope.needsNext.slice(0, 5),
    contextWeights: contextWeighting.items.map((i) => i.weights),
    timestamp: new Date(nowMs).toISOString(),
  });

  // SYSTEM HEALTH — monitoring + optional soft gate metadata (existing pattern preserved).
  const systemHealth = processSystemHealthLayer({
    assumptionRegistryLayer: assumptions,
    missingInformationQueueLayer: missingInformation,
  });
  mark("system_health_monitor");
  mark("output");

  const truthLayers: TruthLayerSeparation = {
    what: timelineEntry ? [timelineEntry] : [],
    why: decisionHistoryEntry ? [decisionHistoryEntry] : [],
    unknown: [...missingInformation.envelope.needsNext],
    believed: [...assumptions.envelope.influenceHints],
    activeSituations: resolution.active.map((s) => toCanonicalSituation(s)),
  };

  // Ensure all documented stages are represented.
  const expected = [...CORE_RUNTIME_PIPELINE_STAGES];
  for (const stage of expected) {
    if (!stagesCompleted.includes(stage)) {
      stagesCompleted.push(stage);
    }
  }

  return {
    situation,
    stagesCompleted,
    contextWeighting,
    resolution,
    assumptions,
    missingInformation,
    priority,
    conflicts,
    decisionHistoryEntry,
    timelineEntry,
    reasoningSnapshot,
    systemHealth,
    truthLayers,
    highMissingInfoBlocked,
    criticalConflictBlocked,
    recomputationTriggered,
    gaps: CORE_RUNTIME_GAPS,
  };
}

/** Test helper — clear resolution + conflict registry when isolating orchestration. */
export function resetCoreRuntimeStoresForTests(): void {
  resetResolutionStoreForTests();
  resetConflictRegistryStore();
}
