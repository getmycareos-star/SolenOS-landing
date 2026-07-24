/**
 * Delegation Network Layer — work distribution tracking facade.
 * Bridges delegation-layer suggestions + responsibility ownership.
 */

import type { DelegationSuggestion } from "../solenos-layers/derived/compute-delegation";
import type { ResponsibilityLoad } from "../responsibility-graph/types";

/**
 * Strategic moat type — track who owns / delegates work and success rates.
 */
export type DelegationNetworkRecord = {
  task: string;
  owner: string;
  delegatedTo?: string;
  successRate: number;
  /** Compounding telemetry */
  attemptCount?: number;
  successCount?: number;
  lastSuggestedAt?: string;
  reason?: string;
  loadReductionEstimate?: number;
};

/** Alias matching strategic architecture naming. */
export type DelegationNetwork = DelegationNetworkRecord;

type ScopeMap = Map<string, DelegationNetworkRecord>;

const networkByScope = new Map<string, ScopeMap>();

function taskKey(task: string, owner: string): string {
  return `${owner.toLowerCase()}::${task.toLowerCase()}`;
}

function getMap(scopeId: string): ScopeMap {
  let m = networkByScope.get(scopeId);
  if (!m) {
    m = new Map();
    networkByScope.set(scopeId, m);
  }
  return m;
}

export type DelegationNetworkPersistenceAdapter = {
  upsertDelegation(scopeId: string, record: DelegationNetworkRecord): Promise<void>;
  listDelegations(scopeId: string): Promise<DelegationNetworkRecord[]>;
};

const noopPersistence: DelegationNetworkPersistenceAdapter = {
  async upsertDelegation() {},
  async listDelegations() {
    return [];
  },
};

let persistence: DelegationNetworkPersistenceAdapter = noopPersistence;

export function setDelegationNetworkPersistence(
  adapter: DelegationNetworkPersistenceAdapter,
): void {
  persistence = adapter;
}

export function recordDelegationEvent(
  scopeId: string,
  record: DelegationNetworkRecord,
): DelegationNetworkRecord {
  const m = getMap(scopeId);
  const key = taskKey(record.task, record.owner);
  const existing = m.get(key);
  const attemptCount = (existing?.attemptCount ?? 0) + 1;
  const successCount =
    (existing?.successCount ?? 0) +
    (record.successRate >= 0.5 ? 1 : 0);
  const merged: DelegationNetworkRecord = {
    task: record.task,
    owner: record.owner,
    delegatedTo: record.delegatedTo ?? existing?.delegatedTo,
    attemptCount,
    successCount,
    successRate:
      attemptCount > 0
        ? successCount / attemptCount
        : record.successRate,
    lastSuggestedAt: record.lastSuggestedAt ?? new Date().toISOString(),
    reason: record.reason ?? existing?.reason,
    loadReductionEstimate:
      record.loadReductionEstimate ?? existing?.loadReductionEstimate,
  };
  m.set(key, merged);
  return merged;
}

export function listDelegationNetwork(
  scopeId: string,
): readonly DelegationNetworkRecord[] {
  return [...(networkByScope.get(scopeId)?.values() ?? [])];
}

/**
 * Bridge DERIVED delegation suggestions into compounding network.
 * Initial successRate is prior (neutral) until outcomes are recorded.
 */
export function bridgeFromDelegationSuggestions(
  scopeId: string,
  suggestions: readonly DelegationSuggestion[],
  primaryOwner = "Primary caregiver",
): readonly DelegationNetworkRecord[] {
  const now = new Date().toISOString();
  return suggestions.map((s) =>
    recordDelegationEvent(scopeId, {
      task: s.task,
      owner: primaryOwner,
      delegatedTo: s.recommendedPerson,
      successRate: 0.5,
      lastSuggestedAt: now,
      reason: s.reason,
      loadReductionEstimate: s.loadReductionEstimate,
    }),
  );
}

/** Detect overload concentration from responsibility loads. */
export function overloadConcentration(
  loads: readonly ResponsibilityLoad[],
): { personId: string; loadScore: number }[] {
  return loads
    .filter((l) => l.overloaded)
    .map((l) => ({ personId: l.personId, loadScore: l.loadScore }))
    .sort((a, b) => b.loadScore - a.loadScore);
}

export async function persistDelegationNetwork(scopeId: string): Promise<void> {
  for (const rec of listDelegationNetwork(scopeId)) {
    await persistence.upsertDelegation(scopeId, rec);
  }
}

export function resetDelegationNetworkStore(scopeId?: string): void {
  if (scopeId) networkByScope.delete(scopeId);
  else networkByScope.clear();
}
