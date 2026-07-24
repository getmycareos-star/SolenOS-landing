import type { Demand, DemandStatus } from "./types";
import { withPressureScore } from "./pressure";

/** In-memory STATE store for demands — keyed by care_session_id. Demands never auto-delete. */
const demandsBySession = new Map<string, Demand[]>();

export function resetDemandStore(): void {
  demandsBySession.clear();
}

export function listDemands(careSessionId: string): readonly Demand[] {
  return [...(demandsBySession.get(careSessionId) ?? [])];
}

export function listActiveDemands(careSessionId: string): readonly Demand[] {
  return listDemands(careSessionId).filter(
    (d) => d.status === "pending" || d.status === "in_progress",
  );
}

export function getDemand(
  careSessionId: string,
  demandId: string,
): Demand | undefined {
  return listDemands(careSessionId).find((d) => d.id === demandId);
}

export function upsertDemand(careSessionId: string, demand: Demand): Demand {
  const list = demandsBySession.get(careSessionId) ?? [];
  const withScore = withPressureScore(demand);
  const idx = list.findIndex((d) => d.id === withScore.id);
  if (idx === -1) {
    list.push(withScore);
  } else {
    // Preserve terminal history — do not revive completed/cancelled via upsert overwrite
    // unless the incoming status is explicitly a lifecycle advance.
    const existing = list[idx]!;
    if (
      (existing.status === "completed" || existing.status === "cancelled") &&
      (withScore.status === "pending" || withScore.status === "in_progress")
    ) {
      // Keep history; ignore regenerate of same id as active.
      return existing;
    }
    list[idx] = { ...existing, ...withScore, createdAt: existing.createdAt };
  }
  demandsBySession.set(careSessionId, list);
  return list[idx === -1 ? list.length - 1 : idx]!;
}

/**
 * Merge newly generated demands without wiping completed/cancelled history.
 * Existing active demands with same id get metric refresh; terminal statuses stay.
 */
export function mergeGeneratedDemands(
  careSessionId: string,
  generated: readonly Demand[],
): readonly Demand[] {
  for (const d of generated) {
    const existing = getDemand(careSessionId, d.id);
    if (!existing) {
      upsertDemand(careSessionId, d);
      continue;
    }
    if (existing.status === "completed" || existing.status === "cancelled") {
      continue;
    }
    upsertDemand(careSessionId, {
      ...existing,
      ...d,
      status: existing.status,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    });
  }
  return listDemands(careSessionId);
}

export function replaceDemands(
  careSessionId: string,
  demands: readonly Demand[],
): readonly Demand[] {
  const copy = demands.map((d) => withPressureScore(d));
  demandsBySession.set(careSessionId, copy);
  return [...copy];
}

const ALLOWED_TRANSITIONS: Record<DemandStatus, readonly DemandStatus[]> = {
  pending: ["in_progress", "completed", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function transitionDemandStatus(
  careSessionId: string,
  demandId: string,
  toStatus: DemandStatus,
  nowIso = new Date().toISOString(),
): { ok: true; demand: Demand } | { ok: false; violations: string[] } {
  const demand = getDemand(careSessionId, demandId);
  if (!demand) {
    return { ok: false, violations: [`demand not found: ${demandId}`] };
  }
  const allowed = ALLOWED_TRANSITIONS[demand.status];
  if (!allowed.includes(toStatus)) {
    return {
      ok: false,
      violations: [`illegal demand transition ${demand.status} → ${toStatus}`],
    };
  }
  const next: Demand = withPressureScore({
    ...demand,
    status: toStatus,
    updatedAt: nowIso,
    completedAt: toStatus === "completed" ? nowIso : demand.completedAt,
    cancelledAt: toStatus === "cancelled" ? nowIso : demand.cancelledAt,
  });
  upsertDemand(careSessionId, next);
  return { ok: true, demand: next };
}

export function canTransitionDemand(
  from: DemandStatus,
  to: DemandStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}
