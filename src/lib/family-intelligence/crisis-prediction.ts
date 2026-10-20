/**
 * Crisis Prediction Layer — future-focused failure signals facade.
 * Bridges crisis-prevention-layer / computeCrisisRisks (never bare scores).
 */

import type { CrisisRisk } from "../solenos-layers/derived/compute-crisis-risks";

/**
 * Strategic moat type — predict FUTURE failures (burnout, missed meds, hospitalization, conflict).
 * Always includes causal explanation — never unexplained probability alone.
 */
export type CrisisSignal = {
  category: string;
  probability: number;
  explanation: string;
  situationId?: string;
  estimatedTimeToFailure?: number;
  contributingFactors?: string[];
  recordedAt?: string;
};

type ScopeSignals = CrisisSignal[];

const signalsByScope = new Map<string, ScopeSignals>();

export type CrisisPredictionPersistenceAdapter = {
  appendSignals(scopeId: string, signals: CrisisSignal[]): Promise<void>;
  listSignals(scopeId: string): Promise<CrisisSignal[]>;
};

const noopPersistence: CrisisPredictionPersistenceAdapter = {
  async appendSignals() {},
  async listSignals() {
    return [];
  },
};

let persistence: CrisisPredictionPersistenceAdapter = noopPersistence;

export function setCrisisPredictionPersistence(
  adapter: CrisisPredictionPersistenceAdapter,
): void {
  persistence = adapter;
}

function assertHasExplanation(signal: CrisisSignal): void {
  if (!signal.explanation || !signal.explanation.trim()) {
    throw new Error(
      "CrisisSignal requires a causal explanation — never store bare probability scores",
    );
  }
}

export function recordCrisisSignals(
  scopeId: string,
  signals: readonly CrisisSignal[],
): readonly CrisisSignal[] {
  const now = new Date().toISOString();
  const stamped = signals.map((s) => {
    assertHasExplanation(s);
    return {
      ...s,
      explanation: s.explanation.trim(),
      recordedAt: s.recordedAt ?? now,
    };
  });

  const log = signalsByScope.get(scopeId) ?? [];
  log.push(...stamped);
  if (log.length > 200) log.splice(0, log.length - 200);
  signalsByScope.set(scopeId, log);
  return stamped;
}

export function listCrisisSignals(scopeId: string): readonly CrisisSignal[] {
  return signalsByScope.get(scopeId) ?? [];
}

export function latestCrisisSignals(
  scopeId: string,
  limit = 5,
): readonly CrisisSignal[] {
  const all = listCrisisSignals(scopeId);
  return all.slice(-limit);
}

/** Map DERIVED CrisisRisk → strategic CrisisSignal (explanation required). */
export function bridgeFromCrisisRisks(
  scopeId: string,
  risks: readonly CrisisRisk[],
): readonly CrisisSignal[] {
  const signals: CrisisSignal[] = risks.map((r) => {
    const explanation =
      r.explanation?.trim() ||
      `${r.category} risk rising — contributing factors: ${(r.contributingFactors ?? []).join(", ") || "ongoing care pressure"}`;
    return {
      category: r.category,
      probability: r.probability,
      explanation,
      situationId: r.situationId,
      estimatedTimeToFailure: r.estimatedTimeToFailure,
      contributingFactors: [...r.contributingFactors],
    };
  });
  return recordCrisisSignals(scopeId, signals);
}

export async function persistCrisisSignals(scopeId: string): Promise<void> {
  const recent = latestCrisisSignals(scopeId, 10);
  if (recent.length > 0) await persistence.appendSignals(scopeId, [...recent]);
}

export function resetCrisisPredictionStore(scopeId?: string): void {
  if (scopeId) signalsByScope.delete(scopeId);
  else signalsByScope.clear();
}
