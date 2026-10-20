import type { CareProfile } from "../care-profile/types";
import type { Demand } from "../demand-engine/types";
import { isActiveDemandStatus } from "../demand-engine/rank";
import {
  detectOwnershipConflicts,
  inferOwnerAssignments,
} from "./conflicts";
import {
  formatActionWithOwner,
  selectPrimaryOwnerForSurface,
} from "./enrich";
import { runResponsibilityGraphGuarantee } from "./guarantee";
import { computeResponsibilityHealth } from "./health";
import { computeResponsibilityLoads } from "./load";
import {
  evaluateDemandOwnership,
  stableResponsibilityId,
  upsertResponsibility,
} from "./ownership";
import { mergePersons, seedPersonsFromCareProfile } from "./seed";
import {
  cloneResponsibilityGraphState,
  getUserResponsibilityGraphState,
  setUserResponsibilityGraphState,
} from "./store";
import type {
  MissedResponsibilityRecord,
  Responsibility,
  ResponsibilityGraphEnvelope,
  ResponsibilityGraphLayerPayload,
  ResponsibilityGraphLayerResult,
  ResponsibilityGraphState,
} from "./types";

export type ProcessResponsibilityGraphLayerParams = {
  telemetry_user_id?: string;
  careSessionId?: string;
  input: string;
  careProfile?: CareProfile;
  /** Active (+ optional history) demands from Demand Engine. */
  demands: readonly Demand[];
  /** Persist when telemetry_user_id present. */
  persist?: boolean;
  nowMs?: number;
  primaryCaregiverName?: string;
};

function scopeUserId(params: ProcessResponsibilityGraphLayerParams): string {
  return (
    params.telemetry_user_id ??
    params.careSessionId ??
    "__anonymous__"
  );
}

function applyAssignments(params: {
  state: ResponsibilityGraphState;
  demands: readonly Demand[];
  input: string;
  careProfile?: CareProfile;
  nowIso: string;
  primaryCaregiverName?: string;
}): ResponsibilityGraphState {
  const activeDemands = params.demands.filter((d) =>
    isActiveDemandStatus(d.status),
  );
  let persons = mergePersons(
    params.state.persons,
    seedPersonsFromCareProfile(params.careProfile, {
      primaryCaregiverName: params.primaryCaregiverName,
    }),
  );

  const resolvedAssignments = inferOwnerAssignments({
    input: params.input,
    demands: activeDemands,
    persons,
    careProfile: params.careProfile,
  });

  persons = mergePersons(
    persons,
    resolvedAssignments
      .map((a) => a.person)
      .filter((p): p is NonNullable<typeof p> => Boolean(p)),
  );

  let responsibilities = [...params.state.responsibilities];
  const demandsWithActiveOwner = new Set(
    responsibilities
      .filter(
        (r) =>
          r.status === "assigned" ||
          r.status === "accepted" ||
          r.status === "in_progress",
      )
      .map((r) => r.demandId),
  );

  for (const a of resolvedAssignments) {
    if (demandsWithActiveOwner.has(a.demandId)) continue;
    const id = stableResponsibilityId(a.demandId, a.ownerId);
    const next: Responsibility = {
      id,
      demandId: a.demandId,
      ownerId: a.ownerId,
      status: "assigned",
      assignedAt: params.nowIso,
      situationId: a.situationId,
    };
    responsibilities = upsertResponsibility(responsibilities, next);
    demandsWithActiveOwner.add(a.demandId);
  }

  const newConflicts = detectOwnershipConflicts({
    input: params.input,
    careProfile: params.careProfile,
    persons,
    demands: activeDemands,
    existingConflicts: params.state.conflicts,
    nowIso: params.nowIso,
  });
  const conflictIds = new Set(params.state.conflicts.map((c) => c.conflictId));
  const conflicts = [
    ...params.state.conflicts,
    ...newConflicts.filter((c) => !conflictIds.has(c.conflictId)),
  ];

  // Failure tracking: fold failed responsibilities into missed list.
  const missedMap = new Map(
    params.state.missed.map((m) => [m.responsibilityId, m]),
  );
  for (const r of responsibilities) {
    if (r.status !== "failed") continue;
    if (missedMap.has(r.id)) continue;
    const rec: MissedResponsibilityRecord = {
      responsibilityId: r.id,
      demandId: r.demandId,
      ownerId: r.ownerId,
      failedAt: r.completedAt ?? params.nowIso,
    };
    missedMap.set(r.id, rec);
  }

  return {
    userId: params.state.userId,
    persons,
    responsibilities,
    conflicts,
    missed: [...missedMap.values()],
  };
}

function buildEnvelope(params: {
  state: ResponsibilityGraphState;
  demands: readonly Demand[];
  input: string;
}): ResponsibilityGraphEnvelope {
  const activeDemands = params.demands.filter((d) =>
    isActiveDemandStatus(d.status),
  );
  const ownershipEvals = evaluateDemandOwnership({
    demands: activeDemands,
    responsibilities: params.state.responsibilities,
    persons: params.state.persons,
    input: params.input,
  });
  const health = computeResponsibilityHealth({
    ownershipEvals,
    conflicts: params.state.conflicts,
    missed: params.state.missed,
  });
  const loads = computeResponsibilityLoads({
    persons: params.state.persons,
    responsibilities: params.state.responsibilities,
    ownershipEvals,
  });

  const unassignedRatio =
    ownershipEvals.length === 0
      ? 0
      : health.unassignedCount / ownershipEvals.length;
  const conflictBoost = Math.min(0.35, health.conflictCount * 0.08);
  const failureBoost = Math.min(
    0.25,
    health.repeatedFailureOwnerIds.length * 0.1,
  );
  const ownershipUncertainty = Math.min(
    1,
    Math.round((unassignedRatio * 0.6 + conflictBoost + failureBoost) * 100) /
      100,
  );

  const escalate =
    health.criticalUnassignedCount > 0 || health.state === "critical";

  const influenceHints: string[] = [];
  if (health.unassignedCount > 0) {
    influenceHints.push(
      `unassigned_demands=${health.unassignedCount}`,
    );
  }
  if (health.criticalUnassignedCount > 0) {
    influenceHints.push(
      `critical_unassigned=${health.criticalUnassignedCount}`,
    );
  }
  for (const c of params.state.conflicts.filter((x) => !x.resolved).slice(0, 3)) {
    influenceHints.push(`ownership_conflict:${c.conflictId}`);
  }
  for (const load of loads.filter((l) => l.overloaded).slice(0, 3)) {
    influenceHints.push(`overload:${load.personId}`);
  }

  return {
    health,
    ownershipEvals,
    loads,
    ownershipUncertainty,
    escalate,
    influenceHints,
  };
}

/**
 * Process Responsibility Graph after Demand Engine, before Priority.
 * Ownership is STATE; conflicts/unassigned feed BELIEF/uncertainty hints.
 */
export function processResponsibilityGraphLayer(
  params: ProcessResponsibilityGraphLayerParams,
): ResponsibilityGraphLayerResult {
  const userId = scopeUserId(params);
  const nowIso = new Date(params.nowMs ?? Date.now()).toISOString();
  const prior = cloneResponsibilityGraphState(
    getUserResponsibilityGraphState(userId),
  );

  const state = applyAssignments({
    state: { ...prior, userId },
    demands: params.demands,
    input: params.input,
    careProfile: params.careProfile,
    nowIso,
    primaryCaregiverName: params.primaryCaregiverName,
  });

  const envelope = buildEnvelope({
    state,
    demands: params.demands,
    input: params.input,
  });

  const result: ResponsibilityGraphLayerResult = {
    state,
    envelope,
    guarantee: { ok: true, violations: [] },
  };
  result.guarantee = runResponsibilityGraphGuarantee(result);

  const shouldPersist =
    params.persist !== false && Boolean(params.telemetry_user_id);
  if (shouldPersist || params.careSessionId) {
    setUserResponsibilityGraphState(state);
  }

  return result;
}

export function toResponsibilityGraphLayerPayload(
  layer: ResponsibilityGraphLayerResult,
): ResponsibilityGraphLayerPayload {
  const primary = selectPrimaryOwnerForSurface({
    ownershipEvals: layer.envelope.ownershipEvals,
    persons: layer.state.persons,
  });
  return {
    health: layer.envelope.health.state,
    activeDemandCount: layer.envelope.health.activeDemandCount,
    unassignedCount: layer.envelope.health.unassignedCount,
    criticalUnassignedCount: layer.envelope.health.criticalUnassignedCount,
    conflictCount: layer.envelope.health.conflictCount,
    personCount: layer.state.persons.length,
    escalate: layer.envelope.escalate,
    ownershipUncertainty: layer.envelope.ownershipUncertainty,
    primaryOwnerName: primary.ownerName,
    primaryOwnershipState: primary.ownershipState,
    influenceHints: layer.envelope.influenceHints,
    overloadedPersonIds: layer.envelope.loads
      .filter((l) => l.overloaded)
      .map((l) => l.personId),
  };
}

/**
 * Observation for Action Generator — counts/flags only, never contact-list dumps.
 * Ownership hints encourage named owners in recommendations.
 */
export function formatResponsibilityGraphObservation(
  layer: ResponsibilityGraphLayerResult,
): string {
  const h = layer.envelope.health;
  const primary = selectPrimaryOwnerForSurface({
    ownershipEvals: layer.envelope.ownershipEvals,
    persons: layer.state.persons,
  });
  const ownerBit = primary.ownerName
    ? ` primaryOwner=${primary.ownerName}`
    : " primaryOwner=UNASSIGNED";
  const crit =
    h.criticalUnassignedCount > 0
      ? ` CRITICAL_UNASSIGNED=${h.criticalUnassignedCount}`
      : "";
  return `OBSERVATION: RESPONSIBILITY_GRAPH health=${h.state} assigned=${h.assignedCount} unassigned=${h.unassignedCount} shared=${h.sharedCount} blocked=${h.blockedCount} conflicts=${h.conflictCount} escalate=${layer.envelope.escalate ? 1 : 0} uncertainty=${layer.envelope.ownershipUncertainty.toFixed(2)}${ownerBit}${crit}`;
}

export function applyResponsibilityOwnerToAction(
  layer: ResponsibilityGraphLayerResult,
  action: string,
): string {
  const primary = selectPrimaryOwnerForSurface({
    ownershipEvals: layer.envelope.ownershipEvals,
    persons: layer.state.persons,
  });
  return formatActionWithOwner(primary.ownerName, action);
}

export {
  formatActionWithOwner,
  selectPrimaryOwnerForSurface,
};
