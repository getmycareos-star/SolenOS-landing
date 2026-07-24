/**
 * Durable CareContextRoot — source of truth under `.data/care-context/`.
 * In-memory Map is a cache only.
 */

import type { CareContextRoot } from "../situation-entry/types";
import {
  clearDurableDirectory,
  deleteDurableFile,
  livingCareRecordDataDir,
  readDurableJson,
  sanitizeDurableCareKey,
  writeDurableJson,
} from "../living-care-record-persistence/fs-store";

const GLOBAL_KEY = "__solenos_care_context_cache__";

type GlobalCareContext = typeof globalThis & {
  [GLOBAL_KEY]?: Map<string, CareContextRoot>;
};

export function careContextCache(): Map<string, CareContextRoot> {
  const g = globalThis as GlobalCareContext;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = new Map<string, CareContextRoot>();
  }
  return g[GLOBAL_KEY]!;
}

export function careContextDurablePath(caregiverId: string): string {
  return livingCareRecordDataDir(
    "care-context",
    `${sanitizeDurableCareKey(caregiverId)}.json`,
  );
}

export function loadCareContextFromDurable(
  caregiverId: string,
): CareContextRoot | null {
  return readDurableJson<CareContextRoot>(careContextDurablePath(caregiverId));
}

export function persistCareContextToDurable(root: CareContextRoot): void {
  writeDurableJson(careContextDurablePath(root.care_recipient_id), root);
}

export function deleteCareContextDurable(caregiverId: string): void {
  deleteDurableFile(careContextDurablePath(caregiverId));
}

/** Drop Map cache only — durable files remain (simulates process bounce). */
export function clearCareContextMemoryCache(): void {
  careContextCache().clear();
}

/** Clear cache + durable CareContext files (verify / empty reset). */
export function resetCareContextDurableStore(): void {
  careContextCache().clear();
  clearDurableDirectory(livingCareRecordDataDir("care-context"));
}
