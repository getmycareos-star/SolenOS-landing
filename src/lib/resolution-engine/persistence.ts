import type { TrackedSituation } from "./types";
import { createEmptyTrackedSituation } from "./defaults";

/** In-memory resolution store keyed by care_session_id (and optional user binding). */
const situationsBySession = new Map<string, TrackedSituation[]>();
const sessionByUser = new Map<string, string>();

export function resetResolutionStoreForTests(): void {
  situationsBySession.clear();
  sessionByUser.clear();
}

export function listSituationsForSession(careSessionId: string): TrackedSituation[] {
  return [...(situationsBySession.get(careSessionId) ?? [])];
}

export function listSituationsForUser(userId: string): TrackedSituation[] {
  const sessionId = sessionByUser.get(userId);
  if (!sessionId) return [];
  return listSituationsForSession(sessionId);
}

export function upsertSituation(situation: TrackedSituation): TrackedSituation {
  const list = situationsBySession.get(situation.careSessionId) ?? [];
  const idx = list.findIndex((s) => s.id === situation.id);
  if (idx === -1) {
    list.push(situation);
  } else {
    list[idx] = situation;
  }
  situationsBySession.set(situation.careSessionId, list);
  if (situation.userId) {
    sessionByUser.set(situation.userId, situation.careSessionId);
  }
  return situation;
}

export function replaceSessionSituations(
  careSessionId: string,
  situations: readonly TrackedSituation[],
): TrackedSituation[] {
  const copy = situations.map((s) => ({ ...s, careSessionId }));
  situationsBySession.set(careSessionId, copy);
  const userId = copy.find((s) => s.userId)?.userId;
  if (userId) {
    sessionByUser.set(userId, careSessionId);
  }
  return [...copy];
}

/**
 * Ensure at least one ACTIVE situation exists for the session when starting work.
 * Does not resurrect RESOLVED/ARCHIVED — creates NEW ACTIVE if needed.
 */
export function ensureActiveSituation(params: {
  careSessionId: string;
  userId?: string;
  title: string;
  nowMs?: number;
}): { situations: TrackedSituation[]; active: TrackedSituation; created: boolean } {
  const existing = listSituationsForSession(params.careSessionId);
  const active = existing.find((s) => s.status === "ACTIVE");
  if (active) {
    if (params.userId && !active.userId) {
      const bound = upsertSituation({ ...active, userId: params.userId });
      return {
        situations: listSituationsForSession(params.careSessionId),
        active: bound,
        created: false,
      };
    }
    return { situations: existing, active, created: false };
  }

  const created = createEmptyTrackedSituation({
    title: params.title,
    careSessionId: params.careSessionId,
    userId: params.userId,
    nowMs: params.nowMs,
  });
  upsertSituation(created);
  return {
    situations: listSituationsForSession(params.careSessionId),
    active: created,
    created: true,
  };
}

export function getSituationById(
  careSessionId: string,
  situationId: string,
): TrackedSituation | undefined {
  return listSituationsForSession(careSessionId).find((s) => s.id === situationId);
}

export function listAllTrackedSituations(): readonly TrackedSituation[] {
  return [...situationsBySession.values()].flat();
}

/** Attach preserved refs without deleting prior ones. */
export function appendPreservedRefs(
  situation: TrackedSituation,
  refs: {
    timelineEntryIds?: readonly string[];
    memoryNodeIds?: readonly string[];
    documentIds?: readonly string[];
  },
): TrackedSituation {
  const next: TrackedSituation = {
    ...situation,
    timelineEntryIds: uniqueConcat(situation.timelineEntryIds, refs.timelineEntryIds),
    memoryNodeIds: uniqueConcat(situation.memoryNodeIds, refs.memoryNodeIds),
    documentIds: uniqueConcat(situation.documentIds, refs.documentIds),
  };
  return upsertSituation(next);
}

function uniqueConcat(
  base: readonly string[],
  extra?: readonly string[],
): string[] {
  if (!extra || extra.length === 0) return [...base];
  return [...new Set([...base, ...extra])];
}
