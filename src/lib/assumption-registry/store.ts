import { randomUUID } from "node:crypto";
import type {
  Assumption,
  AssumptionInvalidationEvent,
  AssumptionRegistryState,
  AssumptionSource,
} from "./types";
import { transitionAssumptionStatus } from "./lifecycle";

export function createAssumption(params: {
  statement: string;
  source: AssumptionSource;
  relatedSituationId?: string;
  confidence?: number;
  nowMs?: number;
}): Assumption {
  const nowIso = new Date(params.nowMs ?? Date.now()).toISOString();
  return {
    assumptionId: randomUUID(),
    statement: params.statement.trim(),
    relatedSituationId: params.relatedSituationId,
    source: params.source,
    status: "active",
    createdAt: nowIso,
    lastCheckedAt: nowIso,
    confidence: Math.max(0, Math.min(1, params.confidence ?? 0.7)),
  };
}

export function addAssumption(
  state: AssumptionRegistryState,
  assumption: Assumption,
): AssumptionRegistryState {
  const duplicate = state.assumptions.some(
    (a) =>
      a.statement.toLowerCase() === assumption.statement.toLowerCase() &&
      a.relatedSituationId === assumption.relatedSituationId &&
      (a.status === "active" || a.status === "validated"),
  );
  if (duplicate) return state;
  return {
    ...state,
    assumptions: [...state.assumptions, assumption],
  };
}

export function validateAssumption(
  state: AssumptionRegistryState,
  assumptionId: string,
  nowMs?: number,
): AssumptionRegistryState {
  const nowIso = new Date(nowMs ?? Date.now()).toISOString();
  return {
    ...state,
    assumptions: state.assumptions.map((a) =>
      a.assumptionId === assumptionId && (a.status === "active" || a.status === "validated")
        ? transitionAssumptionStatus(a, "validated", nowIso)
        : a,
    ),
  };
}

export function invalidateAssumption(
  state: AssumptionRegistryState,
  assumptionId: string,
  reason: string,
  trigger: AssumptionInvalidationEvent["trigger"],
  nowMs?: number,
): { state: AssumptionRegistryState; event?: AssumptionInvalidationEvent } {
  const nowIso = new Date(nowMs ?? Date.now()).toISOString();
  let event: AssumptionInvalidationEvent | undefined;
  const assumptions = state.assumptions.map((a) => {
    if (a.assumptionId !== assumptionId) return a;
    if (a.status === "invalidated" || a.status === "expired") return a;
    event = { assumptionId, reason, trigger };
    return transitionAssumptionStatus(a, "invalidated", nowIso);
  });
  return { state: { ...state, assumptions }, event };
}

export function invalidateAssumptionsForSituation(
  state: AssumptionRegistryState,
  situationId: string,
  reason: string,
  nowMs?: number,
): { state: AssumptionRegistryState; events: AssumptionInvalidationEvent[] } {
  const events: AssumptionInvalidationEvent[] = [];
  let next = state;
  for (const assumption of state.assumptions) {
    if (
      assumption.relatedSituationId === situationId &&
      (assumption.status === "active" || assumption.status === "validated")
    ) {
      const result = invalidateAssumption(
        next,
        assumption.assumptionId,
        reason,
        "resolution",
        nowMs,
      );
      next = result.state;
      if (result.event) events.push(result.event);
    }
  }
  return { state: next, events };
}

export function getAssumptionById(
  state: AssumptionRegistryState,
  assumptionId: string,
): Assumption | undefined {
  return state.assumptions.find((a) => a.assumptionId === assumptionId);
}
