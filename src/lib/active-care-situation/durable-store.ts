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

export function acsDurablePath(careRecipientId: string): string {
  return livingCareRecordDataDir(
    "active-care-situation",
    `${sanitizeDurableCareKey(careRecipientId)}.json`,
  );
}

export function loadActiveCareSituationFromDurable(
  careRecipientId: string,
): ActiveCareSituation | null {
  return readDurableJson<ActiveCareSituation>(acsDurablePath(careRecipientId));
}

export function persistActiveCareSituationToDurable(
  situation: ActiveCareSituation,
): void {
  const careRecipientId = situation.care_recipient_id?.trim();
  if (!careRecipientId || careRecipientId === "default" || careRecipientId === "default_caregiver") {
    throw new Error("Explicit care-recipient identity is required to persist Active Care Situation.");
  }
  writeDurableJson(acsDurablePath(careRecipientId), situation);
}

export function deleteActiveCareSituationDurable(careRecipientId: string): void {
  deleteDurableFile(acsDurablePath(careRecipientId));
}

/** Drop Map cache only — durable files remain (simulates process bounce). */
export function clearActiveCareSituationMemoryCache(): void {
  acsCache().clear();
}

/** Clear cache + durable ACS files (verify / empty reset). */
export function resetActiveCareSituationDurableStore(): void {
  clearDurableDirectory(livingCareRecordDataDir("active-care-situation"));
  acsCache().clear();
}
