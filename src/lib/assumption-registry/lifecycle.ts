import type { Assumption, AssumptionStatus } from "./types";

const VALID_TRANSITIONS: Record<AssumptionStatus, readonly AssumptionStatus[]> = {
  active: ["validated", "invalidated", "expired"],
  validated: ["invalidated", "expired"],
  invalidated: [],
  expired: [],
};

export function canTransitionAssumptionStatus(
  from: AssumptionStatus,
  to: AssumptionStatus,
): boolean {
  if (from === to) return true;
  return VALID_TRANSITIONS[from].includes(to);
}

export function transitionAssumptionStatus(
  assumption: Assumption,
  to: AssumptionStatus,
  nowIso: string,
): Assumption {
  if (!canTransitionAssumptionStatus(assumption.status, to)) {
    return assumption;
  }
  return {
    ...assumption,
    status: to,
    lastCheckedAt: nowIso,
  };
}

export function isInfluenceableStatus(status: AssumptionStatus): boolean {
  return status === "active" || status === "validated";
}
