/**
 * Compounding write path — append analyze/observation interactions into strategic stores.
 * Non-blocking: never throws into the analyze success path.
 */

import type { CareProfile } from "../care-profile/types";
import type { ResponsibilityGraphState, ResponsibilityLoad } from "../responsibility-graph/types";
import type { MemoryInfluenceEntry } from "../memory-influence/types";
import type { DecisionHistory as ExplanationDecisionHistory } from "../decision-history/types";
import type { ExplanationDecisionRecord } from "../solenos-layers/types";
import type { CrisisRisk } from "../solenos-layers/derived/compute-crisis-risks";
import type { DelegationSuggestion } from "../solenos-layers/derived/compute-delegation";
import type { ConfidenceState as DerivedConfidenceState } from "../solenos-layers/derived/compute-confidence";

import {
  appendCareEvent,
  bridgeFromMemoryInfluence,
  getFamilyMemory,
  persistFamilyMemory,
} from "./family-memory";
import {
  bridgeFromResponsibilityGraph,
  getCareGraph,
  persistCareGraph,
} from "./care-graph";
import {
  bridgeFromExplanationDecision,
  listDecisionHistory,
  persistDecisionHistory,
  type StrategicDecisionRecord,
} from "./decision-history";
import {
  bridgeFromDelegationSuggestions,
  listDelegationNetwork,
  persistDelegationNetwork,
} from "./delegation-network";
import {
  bridgeFromCrisisRisks,
  latestCrisisSignals,
  persistCrisisSignals,
} from "./crisis-prediction";
import {
  bridgeFromConfidenceLayer,
  getLatestConfidence,
} from "./confidence-state";
import {
  buildTrustMechanismsSnapshot,
  type TrustMechanismsSnapshot,
} from "./trust-mechanisms";
import type { FamilyMemory } from "./family-memory";
import type { CareGraph } from "./care-graph";
import type { CrisisSignal } from "./crisis-prediction";
import type { ConfidenceState } from "./confidence-state";
import type { DelegationNetworkRecord } from "./delegation-network";

/** Aggregate read-mostly snapshot for AnalyzePipelineRun. */
export type FamilyIntelligenceSnapshot = {
  scopeId: string;
  capturedAt: string;
  familyMemory: FamilyMemory;
  careGraph: CareGraph;
  decisionHistory: readonly StrategicDecisionRecord[];
  delegationNetwork: readonly DelegationNetworkRecord[];
  crisisSignals: readonly CrisisSignal[];
  confidence: ConfidenceState | null;
  trust: TrustMechanismsSnapshot;
  /** Which product-rule assets improved this turn. */
  assetsImprovedThisTurn: readonly string[];
};

export type CompoundAnalyzeInteractionInput = {
  scopeId: string;
  careProfile?: CareProfile | null;
  responsibilityState?: ResponsibilityGraphState | null;
  responsibilityLoads?: readonly ResponsibilityLoad[];
  memoryInfluenceEntries?: readonly MemoryInfluenceEntry[];
  decision?: ExplanationDecisionHistory | ExplanationDecisionRecord | null;
  crisisRisks?: readonly CrisisRisk[];
  delegationSuggestions?: readonly DelegationSuggestion[];
  confidence?: DerivedConfidenceState | null;
  primaryOwnerName?: string;
  careEventSummary?: string;
};

/**
 * Append one analyze interaction into compounding stores and return snapshot.
 * Safe for pipeline use — swallows persistence errors.
 */
export function compoundAnalyzeInteraction(
  input: CompoundAnalyzeInteractionInput,
): FamilyIntelligenceSnapshot {
  const { scopeId } = input;
  const assetsImproved: string[] = [];

  if (input.responsibilityState || input.careProfile) {
    bridgeFromResponsibilityGraph(
      scopeId,
      input.responsibilityState ?? {
        userId: scopeId,
        persons: [],
        responsibilities: [],
        conflicts: [],
        missed: [],
      },
      input.responsibilityLoads ?? [],
      input.careProfile,
    );
    assetsImproved.push("Family Memory", "Care Graph");
  }

  if (input.memoryInfluenceEntries && input.memoryInfluenceEntries.length > 0) {
    bridgeFromMemoryInfluence(scopeId, input.memoryInfluenceEntries);
    assetsImproved.push("Family Memory");
  }

  if (input.careEventSummary) {
    appendCareEvent(scopeId, {
      id: `evt_${Date.now()}`,
      kind: "analyze_interaction",
      summary: input.careEventSummary.slice(0, 240),
      personIds: [],
      timestamp: new Date().toISOString(),
      source: "analyze",
    });
    assetsImproved.push("Family Memory");
  }

  let decision: StrategicDecisionRecord | null = null;
  if (input.decision) {
    decision = bridgeFromExplanationDecision(scopeId, input.decision);
    assetsImproved.push("Decision History", "User Trust");
  }

  if (input.crisisRisks && input.crisisRisks.length > 0) {
    bridgeFromCrisisRisks(scopeId, input.crisisRisks);
    assetsImproved.push("Crisis Prediction", "User Trust");
  }

  if (input.delegationSuggestions && input.delegationSuggestions.length > 0) {
    bridgeFromDelegationSuggestions(
      scopeId,
      input.delegationSuggestions,
      input.primaryOwnerName ?? "Primary caregiver",
    );
    assetsImproved.push("Delegation Network");
  }

  let confidence: ConfidenceState | null = null;
  if (input.confidence) {
    confidence = bridgeFromConfidenceLayer(scopeId, input.confidence);
    assetsImproved.push("Confidence Engine", "User Trust");
  } else {
    confidence = getLatestConfidence(scopeId);
  }

  // Fire-and-forget persistence stubs (non-blocking).
  void Promise.all([
    persistFamilyMemory(scopeId),
    persistCareGraph(scopeId),
    persistDecisionHistory(scopeId),
    persistDelegationNetwork(scopeId),
    persistCrisisSignals(scopeId),
  ]).catch(() => {
    /* MVP stubs — never block analyze */
  });

  return buildFamilyIntelligenceSnapshot(scopeId, {
    decision,
    confidence,
    assetsImprovedThisTurn: [...new Set(assetsImproved)],
  });
}

export function buildFamilyIntelligenceSnapshot(
  scopeId: string,
  opts?: {
    decision?: StrategicDecisionRecord | null;
    confidence?: ConfidenceState | null;
    assetsImprovedThisTurn?: readonly string[];
  },
): FamilyIntelligenceSnapshot {
  const familyMemory = getFamilyMemory(scopeId);
  const careGraph = getCareGraph(scopeId);
  const decisionHistory = listDecisionHistory(scopeId);
  const crises = latestCrisisSignals(scopeId, 5);
  const confidence =
    opts?.confidence ?? getLatestConfidence(scopeId);
  const decision =
    opts?.decision ??
    (decisionHistory.length > 0
      ? decisionHistory[decisionHistory.length - 1]!
      : null);

  const trust = buildTrustMechanismsSnapshot({
    memory: familyMemory,
    careGraph,
    decision,
    confidence,
    crises,
  });

  return {
    scopeId,
    capturedAt: new Date().toISOString(),
    familyMemory,
    careGraph,
    decisionHistory,
    delegationNetwork: listDelegationNetwork(scopeId),
    crisisSignals: crises,
    confidence,
    trust,
    assetsImprovedThisTurn: opts?.assetsImprovedThisTurn ?? [],
  };
}
