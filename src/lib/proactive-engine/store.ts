/**
 * Proactive engagement — check-ins, re-evaluation, anticipatory guidance.
 *
 * Everything happens in response to input. This layer adds the missing
 * proactive capability: when to reach out, when to re-evaluate open
 * questions, and what to say before the caregiver asks.
 */

import type { ProactiveEngine } from "./types";
import {
  livingCareRecordDataDir,
  readDurableJson,
  sanitizeDurableCareKey,
  writeDurableJson,
  clearDurableDirectory,
} from "../living-care-record-persistence/fs-store";
import { createEmptyProactiveEngine } from "./types";

const proactiveCache = new Map<string, ProactiveEngine>();

function proactiveDir(...parts: string[]): string {
  return livingCareRecordDataDir("proactive-engine", ...parts);
}

function filePath(careRecipientId: string): string {
  return proactiveDir(`${sanitizeDurableCareKey(careRecipientId)}.json`);
}

export function getProactiveEngine(careRecipientId: string): ProactiveEngine | null {
  const id = sanitizeDurableCareKey(careRecipientId);
  const cached = proactiveCache.get(id);
  if (cached) return cached;
  const durable = readDurableJson<ProactiveEngine>(filePath(id));
  if (durable && durable.version) {
    proactiveCache.set(id, durable);
    return durable;
  }
  return null;
}

export function saveProactiveEngine(model: ProactiveEngine): void {
  const key = sanitizeDurableCareKey(model.careRecipientId);
  model.updatedAt = new Date().toISOString();
  proactiveCache.set(key, model);
  writeDurableJson(filePath(key), model);
}

export function getOrCreateProactiveEngine(careRecipientId: string): ProactiveEngine {
  const existing = getProactiveEngine(careRecipientId);
  if (existing) return existing;
  const model = createEmptyProactiveEngine(careRecipientId);
  saveProactiveEngine(model);
  return model;
}

export function resetProactiveEngineStore(): void {
  proactiveCache.clear();
  clearDurableDirectory(proactiveDir());
}

export function listProactiveEngines(): readonly ProactiveEngine[] {
  return [...proactiveCache.values()];
}