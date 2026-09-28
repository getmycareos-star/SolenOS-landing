/**
 * Caregiver as person — identity, capacity, fears, values.
 */

import type { CaregiverPersonModel } from "./types";
import {
  livingCareRecordDataDir,
  readDurableJson,
  sanitizeDurableCareKey,
  writeDurableJson,
  clearDurableDirectory,
} from "../living-care-record-persistence/fs-store";
import { createEmptyCaregiverPerson } from "./types";

const caregiverPersonCache = new Map<string, CaregiverPersonModel>();

function caregiverPersonDir(...parts: string[]): string {
  return livingCareRecordDataDir("caregiver-person", ...parts);
}

function filePath(caregiverId: string): string {
  return caregiverPersonDir(`${sanitizeDurableCareKey(caregiverId)}.json`);
}

export function getCaregiverPerson(caregiverId: string): CaregiverPersonModel | null {
  const id = sanitizeDurableCareKey(caregiverId);
  const cached = caregiverPersonCache.get(id);
  if (cached) return cached;
  const durable = readDurableJson<CaregiverPersonModel>(filePath(id));
  if (durable && durable.version) {
    caregiverPersonCache.set(id, durable);
    return durable;
  }
  return null;
}

export function saveCaregiverPerson(model: CaregiverPersonModel): void {
  const key = sanitizeDurableCareKey(model.caregiverId);
  model.updatedAt = new Date().toISOString();
  caregiverPersonCache.set(key, model);
  writeDurableJson(filePath(key), model);
}

export function getOrCreateCaregiverPerson(params: {
  caregiverId: string;
  displayName?: string | null;
  relationshipToPerson?: string | null;
}): CaregiverPersonModel {
  const existing = getCaregiverPerson(params.caregiverId);
  if (existing) return existing;
  const model = createEmptyCaregiverPerson(params);
  saveCaregiverPerson(model);
  return model;
}

export function resetCaregiverPersonStore(): void {
  caregiverPersonCache.clear();
  clearDurableDirectory(caregiverPersonDir());
}