/**
 * Outcome feedback loop — did recommendations work? Model updating.
 */

import type { OutcomeFeedbackLoop, RecommendationOutcome } from "./types";
import {
  livingCareRecordDataDir,
  readDurableJson,
  sanitizeDurableCareKey,
  writeDurableJson,
  clearDurableDirectory,
} from "../living-care-record-persistence/fs-store";
import { createEmptyOutcomeFeedback, recordOutcome } from "./types";

const outcomeCache = new Map<string, OutcomeFeedbackLoop>();

function outcomeDir(...parts: string[]): string {
  return livingCareRecordDataDir("outcome-feedback", ...parts);
}

function filePath(careRecipientId: string): string {
  return outcomeDir(`${sanitizeDurableCareKey(careRecipientId)}.json`);
}

export function getOutcomeFeedback(careRecipientId: string): OutcomeFeedbackLoop | null {
  const id = sanitizeDurableCareKey(careRecipientId);
  const cached = outcomeCache.get(id);
  if (cached) return cached;
  const durable = readDurableJson<OutcomeFeedbackLoop>(filePath(id));
  if (durable && durable.version) {
    outcomeCache.set(id, durable);
    return durable;
  }
  return null;
}

export function saveOutcomeFeedback(loop: OutcomeFeedbackLoop): void {
  const key = sanitizeDurableCareKey(loop.careRecipientId);
  loop.updatedAt = new Date().toISOString();
  outcomeCache.set(key, loop);
  writeDurableJson(filePath(key), loop);
}

export function getOrCreateOutcomeFeedback(careRecipientId: string): OutcomeFeedbackLoop {
  const existing = getOutcomeFeedback(careRecipientId);
  if (existing) return existing;
  const loop = createEmptyOutcomeFeedback(careRecipientId);
  saveOutcomeFeedback(loop);
  return loop;
}

export function appendOutcome(
  careRecipientId: string,
  outcome: Omit<RecommendationOutcome, "id">,
): OutcomeFeedbackLoop {
  const loop = getOrCreateOutcomeFeedback(careRecipientId);
  const updated = recordOutcome(loop, outcome);
  saveOutcomeFeedback(updated);
  return updated;
}

export function resetOutcomeFeedbackStore(): void {
  outcomeCache.clear();
  clearDurableDirectory(outcomeDir());
}
