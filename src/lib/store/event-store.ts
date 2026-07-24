import type {
  CareEvent,
  CareEventType,
  CognitiveVersion,
  SolenOSStore,
  Timestamp,
  User,
} from "./types";
import { COGNITIVE_VERSION } from "./version";
import { checksum, createAnonymousUserId, createSessionId, newId, nowIso } from "./utils";

export function createStore(): SolenOSStore {
  return {
    users: [],
    sessions: [],
    events: [],
    signals: [],
    decisions: [],
    memory: [],
    snapshots: [],
    causal_links: [],
    trust_state: [],
  };
}

export function createUser(
  store: SolenOSStore,
  profile: User["profile"] = { role: "caregiver" },
): User {
  const user: User = {
    id: createAnonymousUserId(),
    created_at: nowIso(),
    profile,
  };
  store.users.push(user);
  return user;
}

export function createSession(store: SolenOSStore, userId: string): string {
  const ts = nowIso();
  const session = {
    session_id: createSessionId(),
    user_id: userId,
    started_at: ts,
    last_active: ts,
    kernel_version: COGNITIVE_VERSION.kernel_version,
  };
  store.sessions.push(session);
  store.trust_state.push({
    session_id: session.session_id,
    system_confidence: 0.5,
    user_override_rate: 0,
    contradiction_rate: 0,
    stable_decision_score: 0.5,
    updated_at: ts,
  });
  return session.session_id;
}

export function getSessionEvents(store: SolenOSStore, sessionId: string): CareEvent[] {
  return store.events.filter((e) => e.session_id === sessionId);
}

export function appendEvent(
  store: SolenOSStore,
  params: {
    session_id: string;
    user_id: string;
    type: CareEventType;
    payload: Record<string, unknown>;
    event_time?: Timestamp;
  },
): CareEvent {
  const offset = getSessionEvents(store, params.session_id).length;
  const processing_time = nowIso();
  const payload = { ...params.payload };

  const event: CareEvent = {
    event_id: newId("evt", params.session_id, offset),
    session_id: params.session_id,
    user_id: params.user_id,
    type: params.type,
    payload,
    temporal: {
      event_time: params.event_time ?? processing_time,
      processing_time,
    },
    cognitive_version: { ...COGNITIVE_VERSION },
    integrity: {
      checksum: checksum(payload),
      immutable: true,
    },
  };

  store.events.push(event);

  const session = store.sessions.find((s) => s.session_id === params.session_id);
  if (session) {
    session.last_active = processing_time;
  }

  return event;
}

export function linkEvents(
  store: SolenOSStore,
  sourceId: string,
  targetId: string,
  relationship: import("./types").CausalLink["relationship"],
): void {
  store.causal_links.push({
    source_event_id: sourceId,
    target_event_id: targetId,
    relationship,
  });
}

export function assertEventImmutable(event: CareEvent): void {
  if (!event.integrity.immutable) {
    throw new Error("Event integrity violation: event must be immutable");
  }
}

export function validateStoreInvariants(store: SolenOSStore): string[] {
  const errors: string[] = [];

  for (const snap of store.signals) {
    const source = store.events.find((e) => e.event_id === snap.source_event_id);
    if (!source) errors.push(`Signal ${snap.signal_id} missing source event`);
  }

  for (const dec of store.decisions) {
    const source = store.events.find((e) => e.event_id === dec.source_event_id);
    if (!source) errors.push(`Decision ${dec.decision_id} missing source event`);
  }

  for (const mem of store.memory) {
    const source = store.events.find((e) => e.event_id === mem.source_event_id);
    if (!source) errors.push(`Memory ${mem.memory_id} missing source event`);
    if (mem.session_id !== source?.session_id) {
      errors.push(`Memory ${mem.memory_id} cross-session source mismatch`);
    }
  }

  const sessionIds = new Set(store.sessions.map((s) => s.session_id));
  for (const evt of store.events) {
    if (!sessionIds.has(evt.session_id)) {
      errors.push(`Event ${evt.event_id} orphan session`);
    }
  }

  return errors;
}
