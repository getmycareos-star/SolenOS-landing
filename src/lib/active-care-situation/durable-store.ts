/**
 * Durable Active Care Situation — source of truth under `.data/active-care-situation/`.
 * In-memory Map is a cache only.
 */

import type { ActiveCareSituation } from "./types";
import {
  clearDurableDirectory,
  deleteDurableFile,
  livingCareRecordDataDir,
  readDurableJson,
  sanitizeDurableCareKey,
  writeDurableJson,
  withDurableFileLock,
} from "../living-care-record-persistence/fs-store";

const GLOBAL_KEY = "__solenos_acs_cache__";

type GlobalAcs = typeof globalThis & {
  [GLOBAL_KEY]?: Map<string, ActiveCareSituation>;
};

export function acsCache(): Map<string, ActiveCareSituation> {
  const g = globalThis as GlobalAcs;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = new Map<string, ActiveCareSituation>();
  }
  return g[GLOBAL_KEY]!;
}

export function acsDurablePath(caregiverId: string): string {
  return livingCareRecordDataDir(
    "active-care-situation",
    `${sanitizeDurableCareKey(caregiverId)}.json`,
  );
}

export function loadActiveCareSituationFromDurable(
  caregiverId: string,
): ActiveCareSituation | null {
  return readDurableJson<ActiveCareSituation>(acsDurablePath(caregiverId));
}

function acsIndexPath(careRecipientId: string): string {
  return livingCareRecordDataDir(
    "active-care-situation-index",
    `${sanitizeDurableCareKey(careRecipientId)}.json`,
  );
}

export function listActiveCareSituationsFromDurable(
  careRecipientId: string,
): ActiveCareSituation[] {
  const indexed = readDurableJson<ActiveCareSituation[]>(acsIndexPath(careRecipientId));
  if (Array.isArray(indexed)) {
    return [...indexed].sort((a, b) => a.opened_at.localeCompare(b.opened_at));
  }
  const current = loadActiveCareSituationFromDurable(careRecipientId);
  return current ? [current] : [];
}

function mergeConcurrentSituationWrites(
  current: ActiveCareSituation,
  incoming: ActiveCareSituation,
): ActiveCareSituation {
  if (current.id !== incoming.id) return incoming;

  const currentTime = Date.parse(current.updated_at) || 0;
  const incomingTime = Date.parse(incoming.updated_at) || 0;
  const preferred = incomingTime >= currentTime ? incoming : current;
  const observationRows = preferred === current
    ? [...incoming.observations, ...current.observations]
    : [...current.observations, ...incoming.observations];
  const observationsById = new Map<string, ActiveCareSituation["observations"][number]>();
  for (const observation of observationRows) {
    observationsById.set(observation.id, observation);
  }
  const union = (left: readonly string[] = [], right: readonly string[] = []) =>
    [...new Set([...left, ...right])];

  const correlations = [
    ...(preferred === current
      ? [...(incoming.cross_signal_correlations ?? []), ...(current.cross_signal_correlations ?? [])]
      : [...(current.cross_signal_correlations ?? []), ...(incoming.cross_signal_correlations ?? [])]),
  ];
  const correlationsByPair = new Map<string, NonNullable<ActiveCareSituation["cross_signal_correlations"]>[number]>();
  for (const correlation of correlations) {
    const key = [correlation.signal_a, correlation.signal_b].sort().join("\\u0000");
    correlationsByPair.set(key, correlation);
  }

  return {
    ...current,
    ...incoming,
    ...preferred,
    care_recipient_id: incoming.care_recipient_id ?? current.care_recipient_id,
    root_event_id: current.root_event_id ?? incoming.root_event_id,
    opened_at: current.opened_at < incoming.opened_at ? current.opened_at : incoming.opened_at,
    updated_at: currentTime > incomingTime ? current.updated_at : incoming.updated_at,
    observations: [...observationsById.values()].sort(
      (left, right) => left.captured_at.localeCompare(right.captured_at) || left.id.localeCompare(right.id),
    ),
    open_questions: union(current.open_questions, incoming.open_questions),
    asked_questions: union(current.asked_questions, incoming.asked_questions),
    familiarity_baseline: union(current.familiarity_baseline, incoming.familiarity_baseline),
    trajectory_by_domain: {
      ...(preferred === current ? incoming.trajectory_by_domain : current.trajectory_by_domain),
      ...(preferred.trajectory_by_domain ?? {}),
    },
    cross_signal_correlations: [...correlationsByPair.values()],
  };
}

/**
 * Persist the current projection and an append-preserving per-recipient index.
 * A new unrelated situation must not erase the prior unresolved situation.
 */
export function persistActiveCareSituationToDurable(
  situation: ActiveCareSituation,
): void {
  const key = situation.care_recipient_id ?? situation.caregiver_id;
  withDurableFileLock(`${acsIndexPath(key)}.lock`, () => {
    // Merge against the latest durable version while holding the lock. Two
    // callers can both start from the same stale snapshot; their distinct
    // observations must both survive the second writer's commit.
    const indexed = readDurableJson<ActiveCareSituation[]>(acsIndexPath(key)) ?? [];
    const position = indexed.findIndex((item) => item.id === situation.id);
    const current = position < 0
      ? readDurableJson<ActiveCareSituation>(acsDurablePath(key))
      : indexed[position]!;
    const merged = current
      ? mergeConcurrentSituationWrites(current, situation)
      : situation;
    writeDurableJson(acsDurablePath(key), merged);
    const next = position < 0
      ? [...indexed, merged]
      : indexed.map((item, index) => index === position ? merged : item);
    writeDurableJson(acsIndexPath(key), next);
  });
}

export function deleteActiveCareSituationDurable(caregiverId: string): void {
  deleteDurableFile(acsDurablePath(caregiverId));
  deleteDurableFile(acsIndexPath(caregiverId));
}

/** Drop Map cache only — durable files remain (simulates process bounce). */
export function clearActiveCareSituationMemoryCache(): void {
  acsCache().clear();
}

/** Clear cache + durable ACS files (verify / empty reset). */
export function resetActiveCareSituationDurableStore(): void {
  acsCache().clear();
  clearDurableDirectory(livingCareRecordDataDir("active-care-situation"));
  clearDurableDirectory(livingCareRecordDataDir("active-care-situation-index"));
}
