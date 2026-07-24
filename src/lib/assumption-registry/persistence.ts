import { createDefaultAssumptionRegistryState } from "./defaults";
import type { AssumptionRegistryState } from "./types";

/** In-memory assumption store keyed by telemetry_user_id — NOT truth persistence. */
const registryByUserId = new Map<string, AssumptionRegistryState>();

export function getUserAssumptionRegistryState(userId: string): AssumptionRegistryState {
  const existing = registryByUserId.get(userId);
  if (existing) return existing;

  const created = createDefaultAssumptionRegistryState(userId);
  registryByUserId.set(userId, created);
  return created;
}

export function setUserAssumptionRegistryState(
  userId: string,
  state: AssumptionRegistryState,
): AssumptionRegistryState {
  const bound = { ...state, userId };
  registryByUserId.set(userId, bound);
  return bound;
}

export function bindAssumptionRegistryToUser(
  userId: string,
  existingState?: AssumptionRegistryState,
): AssumptionRegistryState {
  const stored = registryByUserId.get(userId);
  if (stored) return stored;

  if (existingState) {
    const bound = { ...existingState, userId };
    registryByUserId.set(userId, bound);
    return bound;
  }

  return getUserAssumptionRegistryState(userId);
}

export function clearUserAssumptionRegistryState(userId: string): void {
  registryByUserId.delete(userId);
}

/** Reset in-memory store — for tests only. */
export function resetAssumptionRegistryStore(): void {
  registryByUserId.clear();
}

export function listAllAssumptionRegistryStates(): readonly AssumptionRegistryState[] {
  return [...registryByUserId.values()];
}
