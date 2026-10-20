import {
  getConflictRegistry,
  setConflictRegistry,
  transitionConflictStatus,
} from "./registry";
import type { ConflictRegistry } from "./types";

export type ResolveConflictParams = {
  scopeId: string;
  conflictId: string;
  /** Caregiver response to the clarification question. */
  userResponse: string;
  /**
   * Optional hook — Memory stores facts; Conflict Engine marks resolved.
   * Callers should update memory with the clarified fact outside this module.
   */
  onUpdateMemory?: (clarifiedFact: string) => void;
  nowIso?: string;
};

/**
 * Resolution flow Step 4–5:
 * user response → (caller updates Memory) → mark conflict resolved.
 */
export function resolveConflictFromUserResponse(
  params: ResolveConflictParams,
): ConflictRegistry {
  const note = params.userResponse.trim().slice(0, 400);
  if (params.onUpdateMemory && note) {
    params.onUpdateMemory(note);
  }
  const current = getConflictRegistry(params.scopeId);
  const next = transitionConflictStatus(current, params.conflictId, "resolved", {
    resolutionNote: note,
    nowIso: params.nowIso,
  });
  return setConflictRegistry(params.scopeId, next);
}

export function ignoreConflict(
  scopeId: string,
  conflictId: string,
  nowIso?: string,
): ConflictRegistry {
  const current = getConflictRegistry(scopeId);
  const next = transitionConflictStatus(current, conflictId, "ignored", {
    resolutionNote: "ignored_by_user",
    nowIso,
  });
  return setConflictRegistry(scopeId, next);
}
