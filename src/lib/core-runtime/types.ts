import type { CANONICAL_PRIORITIES, CANONICAL_SITUATION_STATUSES, CORE_RUNTIME_PIPELINE_STAGES } from "./contract-constants";
import type { ConflictDetectionResult } from "../conflict-detection/types";
import type { ContextWeightingResult } from "../context-weighting/types";
import type { DecisionHistory } from "../decision-history/types";
import type { ReasoningSnapshot } from "../reasoning-snapshot/types";
import type { TimelineEntry } from "../ui-runtime/types";
import type { PriorityEngineLayerResult } from "../priority-engine/types";
import type { AssumptionRegistryLayerResult } from "../assumption-registry/types";
import type { MissingInformationQueueLayerResult } from "../missing-information-queue/types";
import type { ResolutionEngineLayerResult } from "../resolution-engine/types";
import type { SystemHealthLayerResult } from "../system-health/types";
import type { FailSafeModeLayerPayload } from "../fail-safe-mode";

export type CanonicalSituationStatus =
  (typeof CANONICAL_SITUATION_STATUSES)[number];

export type CanonicalPriority = (typeof CANONICAL_PRIORITIES)[number];

/**
 * Canonical runtime Situation — PRIMARY UNIT.
 * Hard rule: No Situation = no system state.
 */
export type Situation = {
  id: string;
  status: CanonicalSituationStatus;
  title: string;
  createdAt: string;
  updatedAt: string;
  priority: CanonicalPriority;
  summary: string;
};

export type CoreRuntimePipelineStage =
  (typeof CORE_RUNTIME_PIPELINE_STAGES)[number];

export type TruthLayerSeparation = {
  what: readonly TimelineEntry[];
  why: readonly DecisionHistory[];
  unknown: readonly string[];
  believed: readonly string[];
  activeSituations: readonly Situation[];
};

export type CoreRuntimeOrchestrationInput = {
  scopeId: string;
  userInput: string;
  careSessionId: string;
  telemetryUserId?: string;
  situationTitle?: string;
  nowMs?: number;
  /** When true, skip writing timeline/decision history (dry orchestration). */
  dryRun?: boolean;
};

export type CoreRuntimeOrchestrationResult = {
  situation: Situation;
  stagesCompleted: readonly CoreRuntimePipelineStage[];
  contextWeighting: ContextWeightingResult;
  resolution: ResolutionEngineLayerResult;
  assumptions: AssumptionRegistryLayerResult;
  missingInformation: MissingInformationQueueLayerResult;
  priority: PriorityEngineLayerResult;
  conflicts: ConflictDetectionResult;
  decisionHistoryEntry?: DecisionHistory;
  timelineEntry?: TimelineEntry;
  reasoningSnapshot?: ReasoningSnapshot;
  systemHealth?: SystemHealthLayerResult;
  truthLayers: TruthLayerSeparation;
  /** HIGH missing info blocked high-confidence irreversible posture. */
  highMissingInfoBlocked: boolean;
  /** CRITICAL open medical conflicts restrict decision generation until resolved. */
  criticalConflictBlocked: boolean;
  recomputationTriggered: boolean;
  gaps: readonly string[];
};
