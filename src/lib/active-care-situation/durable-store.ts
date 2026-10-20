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

export function persistActiveCareSituationToDurable(
  situation: ActiveCareSituation,
): void {
  const key = situation.care_recipient_id ?? situation.caregiver_id;
  writeDurableJson(acsDurablePath(key), situation);
}

export function deleteActiveCareSituationDurable(caregiverId: string): void {
  deleteDurableFile(acsDurablePath(caregiverId));
}

/** Drop Map cache only — durable files remain (simulates process bounce). */
export function clearActiveCareSituationMemoryCache(): void {
  acsCache().clear();
}

/** Clear cache + durable ACS files (verify / empty reset). */
export function resetActiveCareSituationDurableStore(): void {
  acsCache().clear();
  clearDurableDirectory(livingCareRecordDataDir("active-care-situation"));
}
