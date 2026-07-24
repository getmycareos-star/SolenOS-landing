import { randomUUID } from "node:crypto";
import type {
  DecisionHistory,
  DecisionHistoryLog,
  WriteDecisionHistoryParams,
} from "./types";

export function createEmptyDecisionHistoryLog(): DecisionHistoryLog {
  return Object.freeze({ entries: Object.freeze([]) as readonly DecisionHistory[] });
}

/**
 * Append-only WHY writer. Never mutates prior entries.
 * HARD SEPARATION: callers must not write these to Timeline.
 */
export function writeDecisionHistory(
  log: DecisionHistoryLog,
  params: WriteDecisionHistoryParams,
): DecisionHistoryLog {
  const situationId = params.situationId.trim();
  if (!situationId) return log;

  const entry: DecisionHistory = Object.freeze({
    situationId,
    decisionId: params.decisionId ?? randomUUID(),
    chosenAction: params.chosenAction.trim() || "unspecified_action",
    rejectedAlternatives: [...(params.rejectedAlternatives ?? [])],
    reasoningSummary: params.reasoningSummary.trim() || "no reasoning summary",
    assumptionsUsed: [...(params.assumptionsUsed ?? [])],
    missingInfoImpact: [...(params.missingInfoImpact ?? [])],
    timestamp: params.timestamp ?? new Date().toISOString(),
  });

  return Object.freeze({
    entries: Object.freeze([...log.entries, entry]),
  });
}

export function decisionHistoryForSituation(
  log: DecisionHistoryLog,
  situationId: string,
): readonly DecisionHistory[] {
  return log.entries.filter((e) => e.situationId === situationId);
}

/** In-memory log keyed by care session / user scope — for runtime orchestration. */
const logsByScope = new Map<string, DecisionHistoryLog>();

export function getDecisionHistoryLog(scopeId: string): DecisionHistoryLog {
  return logsByScope.get(scopeId) ?? createEmptyDecisionHistoryLog();
}

export function setDecisionHistoryLog(
  scopeId: string,
  log: DecisionHistoryLog,
): DecisionHistoryLog {
  logsByScope.set(scopeId, log);
  return log;
}

export function appendDecisionHistoryForScope(
  scopeId: string,
  params: WriteDecisionHistoryParams,
): DecisionHistory {
  const next = writeDecisionHistory(getDecisionHistoryLog(scopeId), params);
  setDecisionHistoryLog(scopeId, next);
  return next.entries[next.entries.length - 1]!;
}

export function resetDecisionHistoryStore(): void {
  logsByScope.clear();
}
