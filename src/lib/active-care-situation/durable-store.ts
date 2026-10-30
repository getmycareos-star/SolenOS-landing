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

/**
 * Persist the current projection and an append-preserving per-recipient index.
 * A new unrelated situation must not erase the prior unresolved situation.
 */
export function persistActiveCareSituationToDurable(
  situation: ActiveCareSituation,
): void {
  const key = situation.care_recipient_id ?? situation.caregiver_id;
  withDurableFileLock(`${acsIndexPath(key)}.lock`, () => {
    writeDurableJson(acsDurablePath(key), situation);
    const indexed = readDurableJson<ActiveCareSituation[]>(acsIndexPath(key)) ?? [];
    const position = indexed.findIndex((item) => item.id === situation.id);
    const next =
      position < 0
        ? [...indexed, situation]
        : indexed.map((item, index) => index === position ? situation : item);
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
