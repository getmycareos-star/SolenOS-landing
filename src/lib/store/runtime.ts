import { runPipeline } from "../process/pipeline";
import { createInitialState } from "../process/types";
import { getSessionMemoryItems, memoryItemsToSessionMemory } from "./memory-adapter";
import { commitTurn } from "./commit";
import { createSession, createStore, createUser, getSessionEvents } from "./event-store";
import type { ExecuteTurnResult, SolenOSStore } from "./types";
import { COGNITIVE_VERSION } from "./version";
import { nowIso } from "./utils";

const idempotencyCache = new Map<string, ExecuteTurnResult>();

export function createDefaultStore(): SolenOSStore {
  return createStore();
}

export function ensureUserAndSession(
  store: SolenOSStore,
  userId?: string,
  sessionId?: string,
): { user_id: string; session_id: string } {
  let uid = userId;
  if (!uid) {
    uid = store.users[0]?.id ?? createUser(store).id;
  } else if (!store.users.find((u) => u.id === uid)) {
    store.users.push({ id: uid, created_at: nowIso(), profile: { role: "caregiver" } });
  }

  let sid = sessionId;
  if (!sid || !store.sessions.find((s) => s.session_id === sid)) {
    sid = createSession(store, uid);
  }

  return { user_id: uid, session_id: sid };
}

export function createSessionForUser(
  store: SolenOSStore,
  userId?: string,
  profile?: { role?: "caregiver" | "patient" | "family" | "admin"; region?: string },
): { user_id: string; session_id: string } {
  const uid = userId ?? createUser(store, profile ?? { role: "caregiver" }).id;
  const session_id = createSession(store, uid);
  return { user_id: uid, session_id };
}

/**
 * MVCR execution: pipeline → validation (in runPipeline) → event commit.
 */
export function executeTurn(
  store: SolenOSStore,
  input: string,
  userId?: string,
  sessionId?: string,
  idempotencyKey?: string,
): ExecuteTurnResult {
  if (idempotencyKey) {
    const cached = idempotencyCache.get(idempotencyKey);
    if (cached) return cached;
  }

  const { user_id, session_id } = ensureUserAndSession(store, userId, sessionId);
  const eventOffsetBefore = getSessionEvents(store, session_id).length;

  const memoryItems = getSessionMemoryItems(store, session_id);
  const kernelState = {
    ...createInitialState(),
    memory: memoryItemsToSessionMemory(memoryItems),
  };

  const { output, new_state } = runPipeline(input.trim(), kernelState);

  const event_offset = commitTurn({
    store,
    session_id,
    user_id,
    input,
    output,
    new_state,
    event_offset_before: eventOffsetBefore,
  });

  const result: ExecuteTurnResult = {
    output,
    session_id,
    user_id,
    event_offset,
    cognitive_version: COGNITIVE_VERSION,
  };

  if (idempotencyKey) {
    idempotencyCache.set(idempotencyKey, result);
  }

  return result;
}

export { getLatestSnapshot } from "./runtime-snapshot";
