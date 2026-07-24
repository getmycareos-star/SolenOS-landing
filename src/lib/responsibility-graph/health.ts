import type {
  DemandOwnershipEval,
  MissedResponsibilityRecord,
  OwnershipConflict,
  ResponsibilityHealth,
  ResponsibilityHealthState,
} from "./types";

/**
 * Responsibility Health:
 * - Healthy: every demand assigned (incl. shared/blocked — owner exists)
 * - At Risk: some unassigned
 * - Critical: high-pressure demand unassigned → escalate
 */
export function computeResponsibilityHealth(params: {
  ownershipEvals: readonly DemandOwnershipEval[];
  conflicts: readonly OwnershipConflict[];
  missed: readonly MissedResponsibilityRecord[];
}): ResponsibilityHealth {
  const evals = params.ownershipEvals;
  const assignedCount = evals.filter(
    (e) => e.ownershipState === "assigned",
  ).length;
  const unassignedCount = evals.filter(
    (e) => e.ownershipState === "unassigned",
  ).length;
  const sharedCount = evals.filter((e) => e.ownershipState === "shared").length;
  const blockedCount = evals.filter(
    (e) => e.ownershipState === "blocked",
  ).length;
  const criticalUnassignedCount = evals.filter(
    (e) => e.criticalUnassigned,
  ).length;
  const conflictCount = params.conflicts.filter((c) => !c.resolved).length;

  const failureCounts = new Map<string, number>();
  for (const m of params.missed) {
    failureCounts.set(m.ownerId, (failureCounts.get(m.ownerId) ?? 0) + 1);
  }
  const repeatedFailureOwnerIds = [...failureCounts.entries()]
    .filter(([, n]) => n >= 2)
    .map(([id]) => id);

  let state: ResponsibilityHealthState = "healthy";
  if (criticalUnassignedCount > 0) {
    state = "critical";
  } else if (unassignedCount > 0 || conflictCount > 0) {
    state = "at_risk";
  }

  const summary =
    state === "healthy"
      ? `All ${evals.length} active demand(s) have ownership`
      : state === "critical"
        ? `${criticalUnassignedCount} high-pressure demand(s) unassigned — escalate`
        : `${unassignedCount} unassigned demand(s); ${conflictCount} ownership conflict(s)`;

  return {
    state,
    activeDemandCount: evals.length,
    assignedCount,
    unassignedCount,
    sharedCount,
    blockedCount,
    criticalUnassignedCount,
    conflictCount,
    repeatedFailureOwnerIds,
    summary,
  };
}
