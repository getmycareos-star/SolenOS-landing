import type { SolenOSResponse } from "../output-contract";
import type { Demand } from "../demand-engine/types";
import type { CaregiverLoadState } from "../caregiver-load-index/types";
import { UI_EVENT_LOOP_STAGES } from "./contract-constants";
import { mapSolenOSToDecisionCard } from "./decision-mapper";
import {
  createSituation,
  titleFromInput,
  updateSituationFromDecision,
  upsertSituation,
} from "./situation-store";
import { appendTimelineEntry, createEmptyTimeline } from "./timeline-store";
import type {
  DecisionSurface,
  DecisionCard,
  Situation,
  TimelineLog,
  UiEventLoopStage,
  UiRuntimeState,
} from "./types";

export type InferenceCycleInput = {
  userInput: string;
  response: SolenOSResponse;
  situationId?: string | null;
  unresolvedQuestions?: string[];
  whatSolenOSNeedsNext?: string[];
  informationNeeded?: readonly {
    question: string;
    importance: "LOW" | "MEDIUM" | "HIGH";
  }[];
  timelineSummary?: string;
  /** CLI-constrained top pressure demands for Decision Surface. */
  topDemands?: readonly (Demand & { ownerName?: string | null })[];
  deferredDemandTitles?: readonly string[];
  caregiverLoadState?: CaregiverLoadState;
  caregiverLoadScore?: number;
  /** Completed demands → timeline WHAT events (never influences decisions). */
  completedDemandTimelineSummaries?: readonly {
    situationId: string;
    summary: string;
  }[];
  owner?: string | null;
  ownershipState?: DecisionCard["ownershipState"];
  explanation?: DecisionCard["explanation"];
  reversibility?: DecisionCard["reversibility"];
  humanTrustEmotionalReadabilityApplied?: boolean;
  recommendationLoadMetadata?: DecisionCard["recommendationLoadMetadata"];
  cognitiveFatigueLevel?: DecisionCard["cognitiveFatigueLevel"];
  caregiverProtectionMode?: boolean;
  confidenceExplanation?: string;
  crisisWarnings?: readonly string[];
  delegationSuggestions?: DecisionCard["delegationSuggestions"];
  emotionalValidation?: DecisionCard["emotionalValidation"];
  containmentMode?: boolean;
  whatNotToDoToday?: readonly string[];
  loadFirstMode?: boolean;
  burdenSummary?: string;
  primaryContributors?: readonly string[];
  interactionLoadFlags?: DecisionCard["interactionLoadFlags"];
  sleepProtectionMode?: boolean;
  outputStrategy?: DecisionCard["outputStrategy"];
  boundaryViolationIndex?: number;
  interactionLoadInsight?: string;
  attentionPriority?: DecisionCard["attentionPriority"];
  attentionLabel?: string;
  attentionClass?: DecisionCard["attentionClass"];
  burnoutTier?: DecisionCard["burnoutTier"];
};

export type InferenceCycleResult = {
  stagesCompleted: readonly UiEventLoopStage[];
  state: UiRuntimeState;
  previousCardReplaced: boolean;
};

function createInitialRuntimeState(): UiRuntimeState {
  return {
    situations: [],
    activeSituationId: null,
    decisionSurface: { activeCard: null },
    timeline: createEmptyTimeline(),
    feedbackCorrections: [],
  };
}

/**
 * UI Event Loop terminal steps (client):
 * Replace Decision Card → Append Timeline Event → Update Situation State
 *
 * Upstream Context→Memory→Time→Priority→Conflict→Action→Safety runs in analyze pipeline;
 * this function completes the UI-facing contract after Output Assembly.
 */
export function applyInferenceCycle(
  prior: UiRuntimeState,
  input: InferenceCycleInput,
): InferenceCycleResult {
  const stagesCompleted = [...UI_EVENT_LOOP_STAGES] as UiEventLoopStage[];

  let situation: Situation | undefined = input.situationId
    ? prior.situations.find((s) => s.id === input.situationId)
    : undefined;

  if (!situation) {
    situation = createSituation({
      id: input.situationId ?? undefined,
      title: titleFromInput(input.userInput),
    });
  }

  const card = mapSolenOSToDecisionCard({
    situationId: situation.id,
    response: input.response,
    unresolvedQuestions: input.unresolvedQuestions,
    whatSolenOSNeedsNext: input.whatSolenOSNeedsNext,
    topDemands: input.topDemands,
    deferredDemandTitles: input.deferredDemandTitles,
    caregiverLoadState: input.caregiverLoadState,
    caregiverLoadScore: input.caregiverLoadScore,
    owner: input.owner,
    ownershipState: input.ownershipState,
    explanation: input.explanation,
    reversibility: input.reversibility,
    humanTrustEmotionalReadabilityApplied: input.humanTrustEmotionalReadabilityApplied,
    recommendationLoadMetadata: input.recommendationLoadMetadata,
    cognitiveFatigueLevel: input.cognitiveFatigueLevel,
    caregiverProtectionMode: input.caregiverProtectionMode,
    confidenceExplanation: input.confidenceExplanation,
    crisisWarnings: input.crisisWarnings,
    delegationSuggestions: input.delegationSuggestions,
    emotionalValidation: input.emotionalValidation,
    containmentMode: input.containmentMode,
    whatNotToDoToday: input.whatNotToDoToday,
    loadFirstMode: input.loadFirstMode,
    burdenSummary: input.burdenSummary,
    primaryContributors: input.primaryContributors,
    interactionLoadFlags: input.interactionLoadFlags,
    sleepProtectionMode: input.sleepProtectionMode,
    outputStrategy: input.outputStrategy,
    boundaryViolationIndex: input.boundaryViolationIndex,
    interactionLoadInsight: input.interactionLoadInsight,
    attentionPriority: input.attentionPriority,
    attentionLabel: input.attentionLabel,
    attentionClass: input.attentionClass,
    burnoutTier: input.burnoutTier,
  });

  const previousCardReplaced = prior.decisionSurface.activeCard !== null;

  // RULE: Every new inference REPLACES the card — never stacks.
  const decisionSurface: DecisionSurface = { activeCard: card };

  const updatedSituation = {
    ...updateSituationFromDecision(situation, {
      riskLevel: card.riskLevel,
      openQuestions: card.unresolvedQuestions,
      nextBestAction: card.nextBestAction,
      whatIsHappening: card.whatIsHappening,
    }),
    informationNeeded: input.informationNeeded,
    nextActions: input.topDemands?.map((d) => d.title) ?? situation.nextActions,
  };

  let timeline: TimelineLog = appendTimelineEntry(prior.timeline, {
    type: "decision",
    situationId: situation.id,
    summary:
      input.timelineSummary ??
      `Decision: ${card.whatMattersNow.slice(0, 140)}${card.whatMattersNow.length > 140 ? "…" : ""}`,
  });

  for (const completed of input.completedDemandTimelineSummaries ?? []) {
    timeline = appendTimelineEntry(timeline, {
      type: "demand_completed",
      situationId: completed.situationId,
      summary: completed.summary,
    });
  }

  const situations = upsertSituation(prior.situations, updatedSituation);

  return {
    stagesCompleted,
    previousCardReplaced,
    state: {
      ...prior,
      situations,
      activeSituationId: situation.id,
      decisionSurface,
      timeline,
    },
  };
}

export function createEmptyUiRuntimeState(): UiRuntimeState {
  return createInitialRuntimeState();
}

export function assertSingleActiveDecisionCard(surface: DecisionSurface): void {
  // Structural invariant: DecisionSurface holds at most one card field.
  const keys = Object.keys(surface).filter((k) => k !== "activeCard");
  if (keys.length > 0) {
    throw new Error("DecisionSurface must only expose activeCard — no stacks or feeds");
  }
}
