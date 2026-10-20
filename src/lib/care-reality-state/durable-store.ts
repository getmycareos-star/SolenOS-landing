/**
 * Durable Care Reality State — Map cache + `.data/care-reality-state/`.
 * Uses shared isomorphic fs helpers (no-ops in the browser).
 */

import type { CareRealityState } from "./types";
import {
  clearDurableDirectory,
  deleteDurableFile,
  livingCareRecordDataDir,
  readDurableJson,
  sanitizeDurableCareKey,
  writeDurableJson,
} from "../living-care-record-persistence/fs-store";

const memory = new Map<string, CareRealityState>();

function filePath(caregiverId: string): string {
  return livingCareRecordDataDir(
    "care-reality-state",
    `${sanitizeDurableCareKey(caregiverId)}.json`,
  );
}

export function crsCache(): Map<string, CareRealityState> {
  return memory;
}

export function loadCareRealityStateFromDurable(
  caregiverId: string,
): CareRealityState | null {
  return readDurableJson<CareRealityState>(filePath(caregiverId));
}

export function persistCareRealityStateToDurable(state: CareRealityState): void {
  const key = state.care_recipient_id ?? state.caregiver_id;
  writeDurableJson(filePath(key), state);
}

export function deleteCareRealityStateDurable(caregiverId: string): void {
  deleteDurableFile(filePath(caregiverId));
}

export function clearCareRealityStateMemoryCache(): void {
  memory.clear();
}

export function resetCareRealityStateDurableStore(): void {
  memory.clear();
  clearDurableDirectory(livingCareRecordDataDir("care-reality-state"));
}
