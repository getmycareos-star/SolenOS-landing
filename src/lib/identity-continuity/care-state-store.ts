import { randomUUID } from "node:crypto";

import type {
  ActiveDecision,
  CareGraphState,
  CareGraphSummary,
  CareStateMode,
  IdentityContinuityState,
  MemoryNode,
} from "./types";

const sessions = new Map<string, IdentityContinuityState>();
const userSessions = new Map<string, string>();

function nowIso(): string {
  return new Date().toISOString();
}

function emptyCareGraph(): CareGraphState {
  const ts = nowIso();
  return {
    care_graph_id: randomUUID(),
    nodes: [],
    created_at: ts,
    updated_at: ts,
  };
}

export function resetCareStateStoreForTests(): void {
  sessions.clear();
  userSessions.clear();
}

export function getCareSession(careSessionId: string): IdentityContinuityState | undefined {
  return sessions.get(careSessionId);
}

export function resolveCareSessionId(existingId?: string): string {
  if (existingId && sessions.has(existingId)) {
    return existingId;
  }
  return existingId ?? randomUUID();
}

export function getOrCreateCareSession(params: {
  care_session_id: string;
  user_id?: string;
  mode?: CareStateMode;
}): IdentityContinuityState {
  const existing = sessions.get(params.care_session_id);
  if (existing) {
    if (params.user_id && !existing.user_id) {
      existing.user_id = params.user_id;
      userSessions.set(params.user_id, params.care_session_id);
    }
    return existing;
  }

  const session: IdentityContinuityState = {
    care_session_id: params.care_session_id,
    user_id: params.user_id,
    mode: params.mode ?? "ephemeral",
    care_graph: emptyCareGraph(),
    memory_nodes: [],
    active_decisions: [],
    has_stored_care_graph: false,
    auth_enabled: false,
  };
  sessions.set(params.care_session_id, session);
  if (params.user_id) {
    userSessions.set(params.user_id, params.care_session_id);
  }
  return session;
}

export function appendCareGraphNode(
  session: IdentityContinuityState,
  summary: CareGraphSummary,
): IdentityContinuityState {
  session.care_graph.nodes.push(summary);
  session.care_graph.updated_at = nowIso();
  session.has_stored_care_graph = session.care_graph.nodes.length > 0;
  sessions.set(session.care_session_id, session);
  return session;
}

export function appendMemoryNode(
  session: IdentityContinuityState,
  params: { interaction_id: string; input_ref: string },
): { session: IdentityContinuityState; node: MemoryNode } {
  const node: MemoryNode = {
    node_id: randomUUID(),
    interaction_id: params.interaction_id,
    input_ref: params.input_ref,
    stored_at: nowIso(),
    is_conclusion: false,
  };
  session.memory_nodes.push(node);
  sessions.set(session.care_session_id, session);
  return { session, node };
}

export function bindActiveDecision(
  session: IdentityContinuityState,
  params: {
    interaction_id: string;
    risk_level: ActiveDecision["risk_level"];
    what_matters_now: string;
  },
): ActiveDecision {
  const decision: ActiveDecision = {
    decision_id: randomUUID(),
    interaction_id: params.interaction_id,
    risk_level: params.risk_level,
    what_matters_now: params.what_matters_now,
    bound_at: nowIso(),
  };
  session.active_decisions.push(decision);
  sessions.set(session.care_session_id, session);
  return decision;
}

export function upgradeSessionToPersistent(
  session: IdentityContinuityState,
  user_id: string,
): IdentityContinuityState {
  session.mode = "persistent";
  session.user_id = user_id;
  session.auth_enabled = true;
  session.has_stored_care_graph = session.care_graph.nodes.length > 0;
  sessions.set(session.care_session_id, session);
  userSessions.set(user_id, session.care_session_id);
  return session;
}

export function getPersistentSessionForUser(userId: string): IdentityContinuityState | undefined {
  const sessionId = userSessions.get(userId);
  if (!sessionId) return undefined;
  const session = sessions.get(sessionId);
  if (!session || session.mode !== "persistent") return undefined;
  return session;
}

export function listAllSessions(): readonly IdentityContinuityState[] {
  return [...sessions.values()];
}
