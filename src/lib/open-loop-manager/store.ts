/**
 * Open Loop Manager — in-memory store.
 *
 * Stores open loops in memory keyed by caregiver_id + care_recipient_id.
 * In production this would be backed by durable storage.
 */

import type { OpenLoop } from "./types";

const store = new Map<string, OpenLoop[]>();

function storeKey(caregiverId: string, careRecipientId: string): string {
  return `${caregiverId}::${careRecipientId}`;
}

export function getOpenLoops(caregiverId: string, careRecipientId: string): OpenLoop[] {
  const key = storeKey(caregiverId, careRecipientId);
  return store.get(key) ?? [];
}

export function getOpenLoopsByCategory(
  caregiverId: string,
  careRecipientId: string,
  category: string,
): OpenLoop[] {
  return getOpenLoops(caregiverId, careRecipientId).filter(
    (l) => l.category === category,
  );
}

export function getOpenLoopById(loopId: string): OpenLoop | null {
  for (const loops of store.values()) {
    const found = loops.find((l) => l.id === loopId);
    if (found) return found;
  }
  return null;
}

export function saveOpenLoops(
  caregiverId: string,
  careRecipientId: string,
  loops: OpenLoop[],
): void {
  const key = storeKey(caregiverId, careRecipientId);
  store.set(key, loops);
}

export function resetOpenLoopStore(): void {
  store.clear();
}
