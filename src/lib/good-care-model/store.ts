/**
 * Good care model — what matters for this person, trade-offs, enoughness.
 */

import type { GoodCareModel } from "./types";
import {
  livingCareRecordDataDir,
  readDurableJson,
  sanitizeDurableCareKey,
  writeDurableJson,
  clearDurableDirectory,
} from "../living-care-record-persistence/fs-store";
import { createEmptyGoodCare } from "./types";

const goodCareCache = new Map<string, GoodCareModel>();

function goodCareDir(...parts: string[]): string {
  return livingCareRecordDataDir("good-care-model", ...parts);
}

function filePath(careRecipientId: string): string {
  return goodCareDir(`${sanitizeDurableCareKey(careRecipientId)}.json`);
}

export function getGoodCareModel(careRecipientId: string): GoodCareModel | null {
  const id = sanitizeDurableCareKey(careRecipientId);
  const cached = goodCareCache.get(id);
  if (cached) return cached;
  const durable = readDurableJson<GoodCareModel>(filePath(id));
  if (durable && durable.version) {
    goodCareCache.set(id, durable);
    return durable;
  }
  return null;
}

export function saveGoodCareModel(model: GoodCareModel): void {
  const key = sanitizeDurableCareKey(model.careRecipientId);
  model.updatedAt = new Date().toISOString();
  goodCareCache.set(key, model);
  writeDurableJson(filePath(key), model);
}

export function getOrCreateGoodCare(careRecipientId: string): GoodCareModel {
  const existing = getGoodCareModel(careRecipientId);
  if (existing) return existing;
  const model = createEmptyGoodCare(careRecipientId);
  saveGoodCareModel(model);
  return model;
}

export function resetGoodCareStore(): void {
  goodCareCache.clear();
  clearDurableDirectory(goodCareDir());
}
