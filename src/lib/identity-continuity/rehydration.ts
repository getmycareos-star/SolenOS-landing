import type { IdentityContinuityState, RehydratedCareState } from "./types";
import {
  getPersistentSessionForUser,
  getCareSession,
} from "./care-state-store";

/**
 * Login = state restoration, NOT auth gate.
 * Performs ONLY rehydration — no onboarding, reconfiguration, or reset.
 */
export function restoreCareGraph(userId: string): RehydratedCareState | null {
  const session = getPersistentSessionForUser(userId);
  if (!session || !session.has_stored_care_graph) {
    return null;
  }
  return {
    care_graph: { ...session.care_graph, nodes: [...session.care_graph.nodes] },
    memory_nodes: [...session.memory_nodes],
    active_decisions: [...session.active_decisions],
    continuity_state: session,
  };
}

export function hydrateMemoryState(userId: string): RehydratedCareState["memory_nodes"] {
  const restored = restoreCareGraph(userId);
  return restored?.memory_nodes ?? [];
}

export function resumeContinuityState(userId: string): IdentityContinuityState | null {
  const session = getPersistentSessionForUser(userId);
  if (!session) return null;
  return { ...session };
}

export function rebindActiveDecisions(userId: string): RehydratedCareState["active_decisions"] {
  const restored = restoreCareGraph(userId);
  return restored?.active_decisions ?? [];
}

export function rehydrateCareState(userId: string): RehydratedCareState | null {
  const session = getPersistentSessionForUser(userId);
  if (!session) return null;

  return {
    care_graph: restoreCareGraph(userId)!.care_graph,
    memory_nodes: hydrateMemoryState(userId),
    active_decisions: rebindActiveDecisions(userId),
    continuity_state: resumeContinuityState(userId)!,
  };
}

export function rehydrateCareSession(careSessionId: string): RehydratedCareState | null {
  const session = getCareSession(careSessionId);
  if (!session || !session.has_stored_care_graph) return null;
  return {
    care_graph: { ...session.care_graph, nodes: [...session.care_graph.nodes] },
    memory_nodes: [...session.memory_nodes],
    active_decisions: [...session.active_decisions],
    continuity_state: session,
  };
}
