/** Person model — lived experience, values, goals, life story, relationship web. */

import type { PersonModel, PersonModelSummary } from "./types";
import {
  livingCareRecordDataDir,
  readDurableJson,
  sanitizeDurableCareKey,
  writeDurableJson,
  clearDurableDirectory,
} from "../living-care-record-persistence/fs-store";
import { createEmptyPersonModel } from "./types";

const personCache = new Map<string, PersonModel>();

function personDir(...parts: string[]): string {
  return livingCareRecordDataDir("person-model", ...parts);
}

function filePath(careRecipientId: string): string {
  return personDir(`${sanitizeDurableCareKey(careRecipientId)}.json`);
}

export function getPersonModel(careRecipientId: string): PersonModel | null {
  const id = sanitizeDurableCareKey(careRecipientId);
  const cached = personCache.get(id);
  if (cached) return cached;
  const durable = readDurableJson<PersonModel>(filePath(id));
  if (durable && durable.version) {
    personCache.set(id, durable);
    return durable;
  }
  return null;
}

export function savePersonModel(model: PersonModel): void {
  const key = sanitizeDurableCareKey(model.careRecipientId);
  model.updatedAt = new Date().toISOString();
  personCache.set(key, model);
  writeDurableJson(filePath(key), model);
}

export function getOrCreatePersonModel(params: {
  careRecipientId: string;
  displayName: string;
  preferredName?: string | null;
  relationship?: string | null;
}): PersonModel {
  const existing = getPersonModel(params.careRecipientId);
  if (existing) return existing;
  const model = createEmptyPersonModel(params);
  savePersonModel(model);
  return model;
}

export function resetPersonModelStore(): void {
  personCache.clear();
  clearDurableDirectory(personDir());
}

export function listPersonModels(): readonly PersonModel[] {
  return [...personCache.values()];
}