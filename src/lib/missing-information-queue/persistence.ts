import { createDefaultMissingInformationQueueState } from "./defaults";
import type { MissingInformationQueueState } from "./types";

/** In-memory queue store keyed by telemetry_user_id — situation-scoped items only. */
const queueByUserId = new Map<string, MissingInformationQueueState>();

export function getUserMissingInformationQueueState(
  userId: string,
): MissingInformationQueueState {
  const existing = queueByUserId.get(userId);
  if (existing) return existing;

  const created = createDefaultMissingInformationQueueState(userId);
  queueByUserId.set(userId, created);
  return created;
}

export function setUserMissingInformationQueueState(
  userId: string,
  state: MissingInformationQueueState,
): MissingInformationQueueState {
  const bound = { ...state, userId };
  queueByUserId.set(userId, bound);
  return bound;
}

export function bindMissingInformationQueueToUser(
  userId: string,
  existingState?: MissingInformationQueueState,
): MissingInformationQueueState {
  const stored = queueByUserId.get(userId);
  if (stored) return stored;

  if (existingState) {
    const bound = { ...existingState, userId };
    queueByUserId.set(userId, bound);
    return bound;
  }

  return getUserMissingInformationQueueState(userId);
}

export function clearUserMissingInformationQueueState(userId: string): void {
  queueByUserId.delete(userId);
}

/** Reset in-memory store — for tests only. */
export function resetMissingInformationQueueStore(): void {
  queueByUserId.clear();
}

export function listAllMissingInformationQueueStates(): readonly MissingInformationQueueState[] {
  return [...queueByUserId.values()];
}
