/**
 * Dialogue record — longitudinal conversation memory.
 *
 * The Living Care Record is event-based. This layer adds the missing piece:
 * what was actually *said*, by whom, when, and what understanding emerged.
 *
 * Without this, continuity breaks: a caregiver returns and cannot recall
 * what was discussed, what was decided, or what was left open.
 */

import type { DialogueRecord, DialogueSummary } from "./types";
import {
  livingCareRecordDataDir,
  readDurableJson,
  sanitizeDurableCareKey,
  writeDurableJson,
  clearDurableDirectory,
} from "../living-care-record-persistence/fs-store";
import { createEmptyDialogue, addTurn } from "./types";

const dialogueCache = new Map<string, DialogueRecord>();

function dialogueDir(...parts: string[]): string {
  return livingCareRecordDataDir("dialogue-record", ...parts);
}

function filePath(careRecipientId: string, dialogueId: string): string {
  return dialogueDir(sanitizeDurableCareKey(careRecipientId), `${sanitizeDurableCareKey(dialogueId)}.json`);
}

export function getDialogueRecord(careRecipientId: string, dialogueId: string): DialogueRecord | null {
  const key = `${sanitizeDurableCareKey(careRecipientId)}::${sanitizeDurableCareKey(dialogueId)}`;
  const cached = dialogueCache.get(key);
  if (cached) return cached;
  const durable = readDurableJson<DialogueRecord>(filePath(careRecipientId, dialogueId));
  if (durable && durable.version) {
    dialogueCache.set(key, durable);
    return durable;
  }
  return null;
}

export function saveDialogueRecord(record: DialogueRecord): void {
  const key = `${sanitizeDurableCareKey(record.careRecipientId)}::${sanitizeDurableCareKey(record.id)}`;
  record.updatedAt = new Date().toISOString();
  dialogueCache.set(key, record);
  writeDurableJson(filePath(record.careRecipientId, record.id), record);
}

export function getOrCreateDialogue(params: {
  careRecipientId: string;
  dialogueId: string;
  createdAt?: string;
}): DialogueRecord {
  const existing = getDialogueRecord(params.careRecipientId, params.dialogueId);
  if (existing) return existing;
  const record = createEmptyDialogue({
    id: params.dialogueId,
    careRecipientId: params.careRecipientId,
    createdAt: params.createdAt,
  });
  saveDialogueRecord(record);
  return record;
}

export function appendDialogueTurn(
  careRecipientId: string,
  dialogueId: string,
  turn: Parameters<typeof addTurn>[1],
): DialogueRecord {
  const record = getOrCreateDialogue({ careRecipientId, dialogueId });
  const updated = addTurn(record, turn);
  saveDialogueRecord(updated);
  return updated;
}

export function listDialoguesForCareRecipient(careRecipientId: string): DialogueSummary[] {
  const id = sanitizeDurableCareKey(careRecipientId);
  const summaries: DialogueSummary[] = [];
  for (const [key, record] of dialogueCache) {
    if (key.startsWith(`${id}::`)) {
      summaries.push({ ...record.summary });
    }
  }
  return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function resetDialogueRecordStore(): void {
  dialogueCache.clear();
  clearDurableDirectory(dialogueDir());
}