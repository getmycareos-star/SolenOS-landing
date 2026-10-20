import { createDefaultMemoryInfluenceState } from "./defaults";
import type { MemoryControl } from "../settings-governance/types";
import type { MemoryInfluenceState } from "./types";

/** In-memory influence store keyed by telemetry_user_id — NOT a truth database. */
const memoryByUserId = new Map<string, MemoryInfluenceState>();

export function getUserMemoryInfluenceState(
  userId: string,
  memoryControl?: MemoryControl,
): MemoryInfluenceState {
  const existing = memoryByUserId.get(userId);
  if (existing) return existing;

  const created = createDefaultMemoryInfluenceState(userId, memoryControl);
  memoryByUserId.set(userId, created);
  return created;
}

export function setUserMemoryInfluenceState(
  userId: string,
  state: MemoryInfluenceState,
): MemoryInfluenceState {
  const bound = { ...state, userId };
  memoryByUserId.set(userId, bound);
  return bound;
}

export function clearUserMemoryInfluenceState(userId: string): void {
  memoryByUserId.delete(userId);
}

export function bindMemoryInfluenceToUser(
  userId: string,
  existingState?: MemoryInfluenceState,
): MemoryInfluenceState {
  const stored = memoryByUserId.get(userId);
  if (stored) return stored;

  if (existingState) {
    const bound = { ...existingState, userId };
    memoryByUserId.set(userId, bound);
    return bound;
  }

  return getUserMemoryInfluenceState(userId);
}

/** Reset in-memory store — for tests only. */
export function resetMemoryInfluenceStore(): void {
  memoryByUserId.clear();
}

export function listAllMemoryInfluenceStates(): readonly MemoryInfluenceState[] {
  return [...memoryByUserId.values()];
}
