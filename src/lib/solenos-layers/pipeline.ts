import {
  addBelief,
  computeBeliefInfluence,
  getBeliefSnapshot,
} from "./belief";
import { SOLENOS_RUNTIME_PIPELINE } from "./contract-constants";
import {
  computeAutonomyGate,
  computeHealthSummary,
  computePriority,
  computeRisk,
} from "./derived";
import { writeExplanationDecision } from "./explanation";
import {
  getStateSnapshot,
  listActiveStateSituations,
  replaceStateSituations,
  toStateSituation,
} from "./state";
import type {
  BeliefItem,
  LayeredRuntimeResult,
  SolenosRuntimeStage,
  StateSituation,
} from "./types";

export type LayeredPipelineInput = {
  careSessionId: string;
  userId?: string;
  /** Situations to upsert into STATE (e.g. from resolution-engine TrackedSituation adapters). */
  situations?: readonly StateSituation[];
  /** Belief seeds (assumptions / missing_information). */
  beliefSeeds?: readonly {
    situationId: string;
    type: BeliefItem["type"];
    content: string;
    confidence?: number;
    importance?: BeliefItem["importance"];
  }[];
  candidateActionIds?: readonly string[];
  /** When true, skip decision history write. */
  dryRun?: boolean;
  scopeId?: string;
};

/**
 * Canonical layered runtime:
 * INPUT → STATE UPDATE → BELIEF UPDATE → DERIVED (Risk, Priority) → ACTION → EXPLANATION
 *
 * ONLY STATE + BELIEF persist. Everything else is computed.
 */
export function runLayeredPipeline(
  input: LayeredPipelineInput,
): LayeredRuntimeResult {
  const stagesCompleted: SolenosRuntimeStage[] = [];
  const mark = (s: SolenosRuntimeStage) => {
    stagesCompleted.push(s);
  };

  mark("INPUT");

  // STATE UPDATE
  if (input.situations && input.situations.length > 0) {
    replaceStateSituations(input.careSessionId, input.situations);
  }
  const state = getStateSnapshot(input.careSessionId);
  mark("STATE_UPDATE");

  // BELIEF UPDATE
  const userId = input.userId ?? input.careSessionId;
  if (input.beliefSeeds) {
    for (const seed of input.beliefSeeds) {
      addBelief(userId, seed);
    }
  }
  const beliefs = getBeliefSnapshot(userId);
  mark("BELIEF_UPDATE");

  // DERIVED COMPUTATION
  const risk = computeRisk(state.situations, beliefs.items);
  const priority = computePriority({
    situations: state.situations,
    beliefs: beliefs.items,
    risk,
    candidateActionIds: input.candidateActionIds,
  });
  const health = computeHealthSummary(state.situations, beliefs.items);
  // Soft safety: autonomy gate is derived from STATE+BELIEF (documented, not a health engine).
  void computeAutonomyGate(state.situations, beliefs.items);
  mark("DERIVED_COMPUTATION");

  mark("ACTION_SELECTION");

  // EXPLANATION OUTPUT
  let decision = undefined;
  if (!input.dryRun) {
    const situationId =
      listActiveStateSituations(input.careSessionId)[0]?.id ??
      state.situations[0]?.id ??
      input.careSessionId;
    const influence = computeBeliefInfluence(beliefs.items);
    const priorityWhy =
      priority.explanationLines?.[0] ??
      (priority.topSituationId
        ? `topSituation=${priority.topSituationId}`
        : `action=${priority.topActionId}`);
    decision = writeExplanationDecision(input.scopeId ?? userId, {
      situationId,
      chosenAction: priority.topActionId,
      rejectedAlternatives: priority.rankedActionIds.slice(1),
      reasoningSummary: priority.highMissingInfoBlocked
        ? `HIGH missing_information belief blocked high-confidence irreversible posture; clarification preferred. PriorityContract: ${priorityWhy}. systemRisk=${risk.systemRiskExposure.toFixed(0)}.`
        : `PriorityContract selected ${priority.topActionId}; ${priorityWhy}${priority.priorityOverrideApplied ? "; SAFETY_OVERRIDE=CRITICAL×NOW" : ""}. systemRisk=${risk.systemRiskExposure.toFixed(0)}.`,
      assumptionsUsed: influence.influenceHints.slice(0, 5),
      missingInfoImpact: influence.needsNext.slice(0, 5),
    });
  }
  mark("EXPLANATION_OUTPUT");

  // Ensure stage order matches contract.
  for (let i = 0; i < SOLENOS_RUNTIME_PIPELINE.length; i++) {
    if (stagesCompleted[i] !== SOLENOS_RUNTIME_PIPELINE[i]) {
      throw new Error(
        `layered pipeline stage order violation at ${i}: expected ${SOLENOS_RUNTIME_PIPELINE[i]}, got ${stagesCompleted[i]}`,
      );
    }
  }

  return {
    state,
    beliefs,
    risk,
    priority,
    health,
    decision,
    stagesCompleted,
  };
}

/** Sync STATE from resolution-engine style tracked situations. */
export function syncStateFromTrackedSituations(
  careSessionId: string,
  tracked: readonly {
    id: string;
    title: string;
    status: string;
    documentIds?: readonly string[];
    userId?: string;
    createdAt?: string;
    updatedAt?: string;
  }[],
  options?: { priority?: string; summary?: string },
): readonly StateSituation[] {
  const mapped = tracked.map((t) =>
    toStateSituation({
      id: t.id,
      status: t.status,
      title: t.title,
      summary: options?.summary ?? t.title,
      priority: options?.priority,
      documentIds: t.documentIds,
      careSessionId,
      userId: t.userId,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }),
  );
  return replaceStateSituations(careSessionId, mapped);
}
