import { createDefaultCareProfileState } from "./defaults";
import { parseCareProfileState } from "./schema";
import type { CareProfileState } from "./types";

/** Versioned in-memory care profile store — survives auth transitions within session scope. */
const profileByUserId = new Map<string, CareProfileState>();

export function getDefaultCareProfileState(userId: string): CareProfileState {
  return createDefaultCareProfileState(userId);
}

export function getUserCareProfileState(userId: string): CareProfileState {
  const existing = profileByUserId.get(userId);
  if (existing) return existing;

  const created = createDefaultCareProfileState(userId);
  profileByUserId.set(userId, created);
  return created;
}

export function setUserCareProfileState(userId: string, state: CareProfileState): CareProfileState {
  const parsed = parseCareProfileState({ ...state, userId });
  profileByUserId.set(userId, parsed);
  return parsed;
}

export function clearUserCareProfileState(userId: string): void {
  profileByUserId.delete(userId);
}

/**
 * Auth upgrade preserves profile — never resets on login/logout.
 * Binds ephemeral profile to persistent user id when first seen.
 */
export function bindCareProfileToUser(
  userId: string,
  existingState?: CareProfileState,
): CareProfileState {
  const stored = profileByUserId.get(userId);
  if (stored) return stored;

  if (existingState && existingState.history.length > 0) {
    const bound = parseCareProfileState({ ...existingState, userId });
    profileByUserId.set(userId, bound);
    return bound;
  }

  return getUserCareProfileState(userId);
}

/** Reset in-memory store — for tests only. */
export function resetCareProfileStore(): void {
  profileByUserId.clear();
}

export function listAllCareProfileStates(): readonly CareProfileState[] {
  return [...profileByUserId.values()];
}
