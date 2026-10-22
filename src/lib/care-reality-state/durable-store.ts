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

function filePath(careRecipientId: string): string {
  return livingCareRecordDataDir(
    "care-reality-state",
    `${sanitizeDurableCareKey(careRecipientId)}.json`,
  );
}

export function crsCache(): Map<string, CareRealityState> {
  return memory;
}

export function loadCareRealityStateFromDurable(
  careRecipientId: string,
): CareRealityState | null {
  return readDurableJson<CareRealityState>(filePath(careRecipientId));
}

export function persistCareRealityStateToDurable(state: CareRealityState): void {
  const careRecipientId = state.care_recipient_id?.trim();
  if (!careRecipientId || careRecipientId === "default" || careRecipientId === "default_caregiver") {
    throw new Error("Explicit care-recipient identity is required to persist Care Reality State.");
  }
  writeDurableJson(filePath(careRecipientId), state);
}

export function deleteCareRealityStateDurable(careRecipientId: string): void {
  deleteDurableFile(filePath(careRecipientId));
}

export function clearCareRealityStateMemoryCache(): void {
  memory.clear();
}

export function resetCareRealityStateDurableStore(): void {
  clearDurableDirectory(livingCareRecordDataDir("care-reality-state"));
  memory.clear();
}
