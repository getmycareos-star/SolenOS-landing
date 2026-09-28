/**
 * Care setting — physical, social, organizational, financial/legal.
 *
 * The system knows about the person and the caregiver. This layer adds the
 * missing context: the environment that shapes care reality.
 */

import type { CareSetting } from "./types";
import {
  livingCareRecordDataDir,
  readDurableJson,
  sanitizeDurableCareKey,
  writeDurableJson,
  clearDurableDirectory,
} from "../living-care-record-persistence/fs-store";
import { createEmptyCareSetting } from "./types";

const careSettingCache = new Map<string, CareSetting>();

function careSettingDir(...parts: string[]): string {
  return livingCareRecordDataDir("care-setting", ...parts);
}

function filePath(careRecipientId: string): string {
  return careSettingDir(`${sanitizeDurableCareKey(careRecipientId)}.json`);
}

export function getCareSetting(careRecipientId: string): CareSetting | null {
  const id = sanitizeDurableCareKey(careRecipientId);
  const cached = careSettingCache.get(id);
  if (cached) return cached;
  const durable = readDurableJson<CareSetting>(filePath(id));
  if (durable && durable.version) {
    careSettingCache.set(id, durable);
    return durable;
  }
  return null;
}

export function saveCareSetting(model: CareSetting): void {
  const key = sanitizeDurableCareKey(model.careRecipientId);
  model.updatedAt = new Date().toISOString();
  careSettingCache.set(key, model);
  writeDurableJson(filePath(key), model);
}

export function getOrCreateCareSetting(careRecipientId: string): CareSetting {
  const existing = getCareSetting(careRecipientId);
  if (existing) return existing;
  const model = createEmptyCareSetting(careRecipientId);
  saveCareSetting(model);
  return model;
}

export function resetCareSettingStore(): void {
  careSettingCache.clear();
  clearDurableDirectory(careSettingDir());
}

export function listCareSettings(): readonly CareSetting[] {
  return [...careSettingCache.values()];
}