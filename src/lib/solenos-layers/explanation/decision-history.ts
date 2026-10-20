import {
  appendDecisionHistoryForScope,
  writeDecisionHistory,
  getDecisionHistoryLog,
  setDecisionHistoryLog,
  createEmptyDecisionHistoryLog,
  decisionHistoryForSituation,
  resetDecisionHistoryStore,
  type DecisionHistory,
  type WriteDecisionHistoryParams,
} from "../../decision-history";
import type { ExplanationDecisionRecord } from "../types";

/**
 * EXPLANATION — Decision History writer (WHY).
 * Must NEVER influence decisions — post-hoc audit only.
 * Hard separation from Timeline (WHAT).
 */
export function writeExplanationDecision(
  scopeId: string,
  params: WriteDecisionHistoryParams,
): DecisionHistory {
  return appendDecisionHistoryForScope(scopeId, params);
}

export function toExplanationDecision(
  entry: DecisionHistory,
): ExplanationDecisionRecord {
  return {
    situationId: entry.situationId,
    decisionId: entry.decisionId,
    chosenAction: entry.chosenAction,
    rejectedAlternatives: entry.rejectedAlternatives,
    reasoningSummary: entry.reasoningSummary,
    assumptionsUsed: entry.assumptionsUsed,
    missingInfoImpact: entry.missingInfoImpact,
    timestamp: entry.timestamp,
  };
}

export {
  writeDecisionHistory,
  getDecisionHistoryLog,
  setDecisionHistoryLog,
  createEmptyDecisionHistoryLog,
  decisionHistoryForSituation,
  resetDecisionHistoryStore,
};

export type { DecisionHistory, WriteDecisionHistoryParams };
