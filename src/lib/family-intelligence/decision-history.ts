/**
 * Decision History Layer — strategic facade over EXPLANATION decision history.
 * Remembers recommendations + outcomes (accepted / ignored / worked / failed).
 */

import type { DecisionHistory as ExplanationDecisionHistory } from "../decision-history/types";
import type { ExplanationDecisionRecord } from "../solenos-layers/types";

/**
 * Strategic moat type — learn from recommendation outcomes over time.
 * Extends existing WHY records with accepted + outcome fields.
 */
export type StrategicDecisionRecord = {
  recommendation: string;
  accepted: boolean;
  outcome: string;
  timestamp: Date;
  /** Links back to EXPLANATION decision history. */
  decisionId?: string;
  situationId?: string;
  rejectedAlternatives?: string[];
  reasoningSummary?: string;
};

/** Alias matching strategic architecture naming. */
export type DecisionHistory = StrategicDecisionRecord;

type ScopeLog = StrategicDecisionRecord[];

const logsByScope = new Map<string, ScopeLog>();

export type DecisionHistoryPersistenceAdapter = {
  appendDecision(scopeId: string, record: StrategicDecisionRecord): Promise<void>;
  listDecisions(scopeId: string): Promise<StrategicDecisionRecord[]>;
};

const noopPersistence: DecisionHistoryPersistenceAdapter = {
  async appendDecision() {},
  async listDecisions() {
    return [];
  },
};

let persistence: DecisionHistoryPersistenceAdapter = noopPersistence;

export function setDecisionHistoryPersistence(
  adapter: DecisionHistoryPersistenceAdapter,
): void {
  persistence = adapter;
}

export function recordDecisionOutcome(
  scopeId: string,
  record: Omit<StrategicDecisionRecord, "timestamp"> & { timestamp?: Date | string },
): StrategicDecisionRecord {
  const entry: StrategicDecisionRecord = {
    recommendation: record.recommendation,
    accepted: record.accepted,
    outcome: record.outcome,
    timestamp:
      record.timestamp instanceof Date
        ? record.timestamp
        : record.timestamp
          ? new Date(record.timestamp)
          : new Date(),
    decisionId: record.decisionId,
    situationId: record.situationId,
    rejectedAlternatives: record.rejectedAlternatives,
    reasoningSummary: record.reasoningSummary,
  };

  const log = logsByScope.get(scopeId) ?? [];
  log.push(entry);
  if (log.length > 500) log.splice(0, log.length - 500);
  logsByScope.set(scopeId, log);
  return entry;
}

export function listDecisionHistory(scopeId: string): readonly StrategicDecisionRecord[] {
  return logsByScope.get(scopeId) ?? [];
}

/**
 * Bridge EXPLANATION DecisionHistory / ExplanationDecisionRecord into strategic store.
 * Default: recommended but outcome unknown until caregiver feedback.
 */
export function bridgeFromExplanationDecision(
  scopeId: string,
  decision: ExplanationDecisionHistory | ExplanationDecisionRecord,
  opts?: { accepted?: boolean; outcome?: string },
): StrategicDecisionRecord {
  return recordDecisionOutcome(scopeId, {
    recommendation: decision.chosenAction,
    accepted: opts?.accepted ?? true,
    outcome:
      opts?.outcome ??
      "recommended — awaiting caregiver outcome feedback",
    timestamp: decision.timestamp,
    decisionId: decision.decisionId,
    situationId: decision.situationId,
    rejectedAlternatives: [...decision.rejectedAlternatives],
    reasoningSummary: decision.reasoningSummary,
  });
}

/**
 * Record outcome update when caregiver accepts/ignores/confirms result.
 */
export function updateDecisionOutcome(
  scopeId: string,
  decisionId: string,
  patch: { accepted: boolean; outcome: string },
): StrategicDecisionRecord | null {
  const log = logsByScope.get(scopeId);
  if (!log) return null;
  const idx = log.findIndex((d) => d.decisionId === decisionId);
  if (idx < 0) return null;
  const next = {
    ...log[idx]!,
    accepted: patch.accepted,
    outcome: patch.outcome,
    timestamp: new Date(),
  };
  log[idx] = next;
  return next;
}

export async function persistDecisionHistory(scopeId: string): Promise<void> {
  const entries = listDecisionHistory(scopeId);
  const last = entries[entries.length - 1];
  if (last) await persistence.appendDecision(scopeId, last);
}

export function resetStrategicDecisionStore(scopeId?: string): void {
  if (scopeId) logsByScope.delete(scopeId);
  else logsByScope.clear();
}
