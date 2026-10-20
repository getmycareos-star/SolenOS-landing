/**
 * Confidence State — bridge to confidence-layer / computeConfidenceState.
 * Always pairs numeric confidence with plain-English explanation ("Am I doing enough?").
 */

import type { ConfidenceState as DerivedConfidenceState } from "../solenos-layers/derived/compute-confidence";

/**
 * Strategic trust type — Reduce Guilt mechanism.
 * NEVER emit confidence without explanation.
 */
export type ConfidenceState = {
  confidence: number;
  explanation: string;
  missingCriticalActions?: number;
  unresolvedHighRiskSituations?: number;
  recordedAt?: string;
};

type ScopeConfidence = ConfidenceState[];

const historyByScope = new Map<string, ScopeConfidence>();

function assertExplanation(state: ConfidenceState): void {
  if (!state.explanation || !String(state.explanation).trim()) {
    throw new Error(
      "ConfidenceState requires explanation string — never emit bare confidence scores",
    );
  }
}

export function recordConfidenceState(
  scopeId: string,
  state: ConfidenceState,
): ConfidenceState {
  assertExplanation(state);
  const entry: ConfidenceState = {
    confidence: state.confidence,
    explanation: state.explanation.trim(),
    missingCriticalActions: state.missingCriticalActions,
    unresolvedHighRiskSituations: state.unresolvedHighRiskSituations,
    recordedAt: state.recordedAt ?? new Date().toISOString(),
  };
  const hist = historyByScope.get(scopeId) ?? [];
  hist.push(entry);
  if (hist.length > 100) hist.splice(0, hist.length - 100);
  historyByScope.set(scopeId, hist);
  return entry;
}

export function getLatestConfidence(scopeId: string): ConfidenceState | null {
  const hist = historyByScope.get(scopeId);
  if (!hist || hist.length === 0) return null;
  return hist[hist.length - 1]!;
}

export function listConfidenceHistory(
  scopeId: string,
): readonly ConfidenceState[] {
  return historyByScope.get(scopeId) ?? [];
}

/** Bridge DERIVED ConfidenceState into strategic store. */
export function bridgeFromConfidenceLayer(
  scopeId: string,
  state: DerivedConfidenceState,
): ConfidenceState {
  return recordConfidenceState(scopeId, {
    confidence: state.confidence,
    explanation: state.explanation,
    missingCriticalActions: state.missingCriticalActions,
    unresolvedHighRiskSituations: state.unresolvedHighRiskSituations,
  });
}

export function resetConfidenceStateStore(scopeId?: string): void {
  if (scopeId) historyByScope.delete(scopeId);
  else historyByScope.clear();
}
