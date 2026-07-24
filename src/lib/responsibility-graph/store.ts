import { createDefaultResponsibilityGraphState } from "./defaults";
import type { ResponsibilityGraphState } from "./types";

/** In-memory STATE store keyed by telemetry_user_id / care session. */
const graphByUserId = new Map<string, ResponsibilityGraphState>();

export function resetResponsibilityGraphStore(): void {
  graphByUserId.clear();
}

export function getUserResponsibilityGraphState(
  userId: string,
): ResponsibilityGraphState {
  const existing = graphByUserId.get(userId);
  if (existing) return existing;
  const created = createDefaultResponsibilityGraphState(userId);
  graphByUserId.set(userId, created);
  return created;
}

export function setUserResponsibilityGraphState(
  state: ResponsibilityGraphState,
): void {
  graphByUserId.set(state.userId, state);
}

export function bindResponsibilityGraphToUser(
  userId: string,
): ResponsibilityGraphState {
  return getUserResponsibilityGraphState(userId);
}

export function clearUserResponsibilityGraphState(userId: string): void {
  graphByUserId.delete(userId);
}

export function listAllResponsibilityGraphStates(): ResponsibilityGraphState[] {
  return [...graphByUserId.values()];
}

export function cloneResponsibilityGraphState(
  state: ResponsibilityGraphState,
): ResponsibilityGraphState {
  return {
    userId: state.userId,
    persons: state.persons.map((p) => ({ ...p })),
    responsibilities: state.responsibilities.map((r) => ({ ...r })),
    conflicts: state.conflicts.map((c) => ({ ...c })),
    missed: state.missed.map((m) => ({ ...m })),
  };
}
