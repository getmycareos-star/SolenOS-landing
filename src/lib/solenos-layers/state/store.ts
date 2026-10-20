import type { StateSituation, StateStoreSnapshot } from "../types";
import { isOperationallyActive } from "./map";

/** Canonical STATE store — single source of situation truth. Keyed by care_session_id. */
const situationsBySession = new Map<string, StateSituation[]>();
const sessionByUser = new Map<string, string>();

export function resetStateStore(): void {
  situationsBySession.clear();
  sessionByUser.clear();
}

export function listStateSituations(careSessionId: string): readonly StateSituation[] {
  return [...(situationsBySession.get(careSessionId) ?? [])];
}

export function listStateSituationsForUser(userId: string): readonly StateSituation[] {
  const sessionId = sessionByUser.get(userId);
  if (!sessionId) return [];
  return listStateSituations(sessionId);
}

export function listActiveStateSituations(
  careSessionId: string,
): readonly StateSituation[] {
  return listStateSituations(careSessionId).filter(isOperationallyActive);
}

export function upsertStateSituation(situation: StateSituation): StateSituation {
  const sessionId = situation.careSessionId ?? "default";
  const list = situationsBySession.get(sessionId) ?? [];
  const idx = list.findIndex((s) => s.id === situation.id);
  const next = { ...situation, careSessionId: sessionId };
  if (idx === -1) {
    list.push(next);
  } else {
    list[idx] = next;
  }
  situationsBySession.set(sessionId, list);
  if (next.userId) {
    sessionByUser.set(next.userId, sessionId);
  }
  return next;
}

export function replaceStateSituations(
  careSessionId: string,
  situations: readonly StateSituation[],
): readonly StateSituation[] {
  const copy = situations.map((s) => ({ ...s, careSessionId }));
  situationsBySession.set(careSessionId, copy);
  const userId = copy.find((s) => s.userId)?.userId;
  if (userId) {
    sessionByUser.set(userId, careSessionId);
  }
  return [...copy];
}

export function getStateSituation(
  careSessionId: string,
  situationId: string,
): StateSituation | undefined {
  return listStateSituations(careSessionId).find((s) => s.id === situationId);
}

export function attachDocumentRefs(
  situation: StateSituation,
  documentIds: readonly string[],
): StateSituation {
  const merged = [...new Set([...situation.documentRefs, ...documentIds])];
  return upsertStateSituation({
    ...situation,
    documentRefs: merged,
    updatedAt: new Date().toISOString(),
  });
}

export function getStateSnapshot(careSessionId: string): StateStoreSnapshot {
  return { situations: listStateSituations(careSessionId) };
}

export function listAllStateSituations(): readonly StateSituation[] {
  return [...situationsBySession.values()].flat();
}
