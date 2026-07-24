/**
 * Phase 12 — Memory Correction System.
 * Never silently overwrite. Maintain history: original + correction event.
 */

import {
  livingCareRecordDataDir,
  readDurableJson,
  sanitizeDurableCareKey,
  writeDurableJson,
  clearDurableDirectory,
} from "../living-care-record-persistence/fs-store";
import { resolveCareRealityStoreKey } from "../multi-caregiver-context-model";

export type MemoryCorrectionRecord = {
  id: string;
  care_recipient_id: string;
  field_label: string;
  original_value: string;
  corrected_value: string;
  corrected_by: string;
  corrected_at: string;
  reason: string | null;
  /** Both sides retained. */
  history_preserved: true;
};

type CorrectionStore = {
  care_recipient_id: string;
  corrections: MemoryCorrectionRecord[];
  updated_at: string;
};

const memory = new Map<string, CorrectionStore>();

function pathFor(id: string): string {
  return livingCareRecordDataDir(
    "memory-corrections",
    `${sanitizeDurableCareKey(id)}.json`,
  );
}

function load(id: string): CorrectionStore {
  const cached = memory.get(id);
  if (cached) return cached;
  const durable = readDurableJson<CorrectionStore>(pathFor(id));
  if (durable?.corrections) {
    memory.set(id, durable);
    return durable;
  }
  return {
    care_recipient_id: id,
    corrections: [],
    updated_at: new Date().toISOString(),
  };
}

function save(store: CorrectionStore): void {
  memory.set(store.care_recipient_id, store);
  writeDurableJson(pathFor(store.care_recipient_id), store);
}

export function recordMemoryCorrection(params: {
  careRecipientId: string;
  fieldLabel: string;
  originalValue: string;
  correctedValue: string;
  correctedBy: string;
  reason?: string | null;
  nowIso?: string;
}): MemoryCorrectionRecord {
  const careRecipientId = resolveCareRealityStoreKey(params.careRecipientId);
  const now = params.nowIso ?? new Date().toISOString();
  const store = load(careRecipientId);
  const record: MemoryCorrectionRecord = {
    id: `corr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    care_recipient_id: careRecipientId,
    field_label: params.fieldLabel.trim(),
    original_value: params.originalValue.trim(),
    corrected_value: params.correctedValue.trim(),
    corrected_by: params.correctedBy,
    corrected_at: now,
    reason: params.reason ?? null,
    history_preserved: true,
  };
  store.corrections = [...store.corrections, record].slice(-100);
  store.updated_at = now;
  save(store);
  return record;
}

export function listMemoryCorrections(
  careRecipientId: string,
): MemoryCorrectionRecord[] {
  return [...load(resolveCareRealityStoreKey(careRecipientId)).corrections];
}

export function resetMemoryCorrectionStore(): void {
  memory.clear();
  clearDurableDirectory(livingCareRecordDataDir("memory-corrections"));
}
