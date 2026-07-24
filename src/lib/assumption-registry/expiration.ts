import type { Assumption, AssumptionRegistryState } from "./types";
import { transitionAssumptionStatus } from "./lifecycle";

function parseIsoMs(iso: string | undefined, fallbackMs: number): number {
  if (!iso) return fallbackMs;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : fallbackMs;
}

export function isAssumptionExpired(
  assumption: Assumption,
  policy: AssumptionRegistryState["policy"],
  nowMs: number,
): boolean {
  if (assumption.status === "expired" || assumption.status === "invalidated") {
    return assumption.status === "expired";
  }
  const anchorMs = parseIsoMs(assumption.lastCheckedAt, parseIsoMs(assumption.createdAt, nowMs));
  const ageDays = (nowMs - anchorMs) / (24 * 60 * 60 * 1000);
  return ageDays >= policy.expirationDays;
}

export function isAssumptionStale(
  assumption: Assumption,
  policy: AssumptionRegistryState["policy"],
  nowMs: number,
): boolean {
  if (!isInfluenceable(assumption)) return false;
  const anchorMs = parseIsoMs(assumption.lastCheckedAt, parseIsoMs(assumption.createdAt, nowMs));
  const ageDays = (nowMs - anchorMs) / (24 * 60 * 60 * 1000);
  return ageDays >= policy.staleDays;
}

function isInfluenceable(assumption: Assumption): boolean {
  return assumption.status === "active" || assumption.status === "validated";
}

/**
 * Periodic expiration — assumptions must NEVER live forever.
 */
export function applyAssumptionExpiration(
  state: AssumptionRegistryState,
  nowMs: number = Date.now(),
): { state: AssumptionRegistryState; expiredIds: string[] } {
  const nowIso = new Date(nowMs).toISOString();
  const expiredIds: string[] = [];
  const assumptions = state.assumptions.map((a) => {
    if (a.status === "invalidated" || a.status === "expired") return a;
    if (!isAssumptionExpired(a, state.policy, nowMs)) return a;
    expiredIds.push(a.assumptionId);
    return transitionAssumptionStatus(a, "expired", nowIso);
  });
  return {
    state: { ...state, assumptions },
    expiredIds,
  };
}

export function daysSinceLastCheck(
  assumption: Assumption,
  nowMs: number,
): number {
  const anchorMs = parseIsoMs(
    assumption.lastCheckedAt,
    parseIsoMs(assumption.createdAt, nowMs),
  );
  return (nowMs - anchorMs) / (24 * 60 * 60 * 1000);
}
