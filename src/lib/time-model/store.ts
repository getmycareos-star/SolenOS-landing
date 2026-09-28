/**
 * Time model beyond clocks — circadian, seasonal, life-stage, decision windows.
 */

import type { TimeModel } from "./types";
import {
  livingCareRecordDataDir,
  readDurableJson,
  sanitizeDurableCareKey,
  writeDurableJson,
  clearDurableDirectory,
} from "../living-care-record-persistence/fs-store";
import { createEmptyTimeModel } from "./types";

const timeModelCache = new Map<string, TimeModel>();

function timeModelDir(...parts: string[]): string {
  return livingCareRecordDataDir("time-model", ...parts);
}

function filePath(careRecipientId: string): string {
  return timeModelDir(`${sanitizeDurableCareKey(careRecipientId)}.json`);
}

export function getTimeModel(careRecipientId: string): TimeModel | null {
  const id = sanitizeDurableCareKey(careRecipientId);
  const cached = timeModelCache.get(id);
  if (cached) return cached;
  const durable = readDurableJson<TimeModel>(filePath(id));
  if (durable && durable.version) {
    timeModelCache.set(id, durable);
    return durable;
  }
  return null;
}

export function saveTimeModel(model: TimeModel): void {
  const key = sanitizeDurableCareKey(model.careRecipientId);
  model.updatedAt = new Date().toISOString();
  timeModelCache.set(key, model);
  writeDurableJson(filePath(key), model);
}

export function getOrCreateTimeModel(careRecipientId: string): TimeModel {
  const existing = getTimeModel(careRecipientId);
  if (existing) return existing;
  const model = createEmptyTimeModel(careRecipientId);
  saveTimeModel(model);
  return model;
}

export function resetTimeModelStore(): void {
  timeModelCache.clear();
  clearDurableDirectory(timeModelDir());
}
