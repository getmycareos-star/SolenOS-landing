import type { StatePriority, StateSituation, StateSituationStatus } from "../types";

/**
 * Map Resolution Engine lifecycle (ACTIVE|RESOLVED|ARCHIVED) → canonical STATE status.
 */
export function mapLifecycleToStateStatus(
  status: "ACTIVE" | "RESOLVED" | "ARCHIVED" | string,
): StateSituationStatus {
  switch (status) {
    case "ACTIVE":
    case "active":
      return "active";
    case "RESOLVED":
    case "resolved":
      return "resolved";
    case "ARCHIVED":
    case "archived":
      return "archived";
    default:
      return "active";
  }
}

export function mapStateStatusToLifecycle(
  status: StateSituationStatus,
): "ACTIVE" | "RESOLVED" | "ARCHIVED" {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "resolved":
      return "RESOLVED";
    case "archived":
      return "ARCHIVED";
  }
}

function inferPriority(raw?: string): StatePriority {
  const u = (raw ?? "MEDIUM").toUpperCase();
  if (u === "LOW" || u === "MEDIUM" || u === "HIGH" || u === "CRITICAL") {
    return u;
  }
  return "MEDIUM";
}

/**
 * Unify TrackedSituation / UI Situation / core-runtime Situation into STATE.
 * Document IDs are pointers only — content never stored in STATE.
 */
export function toStateSituation(params: {
  id: string;
  status: "ACTIVE" | "RESOLVED" | "ARCHIVED" | StateSituationStatus | string;
  title?: string;
  summary?: string;
  priority?: string;
  documentIds?: readonly string[];
  careSessionId?: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
  actionStatus?: StateSituation["actionStatus"];
}): StateSituation {
  const now = new Date().toISOString();
  return {
    id: params.id,
    status: mapLifecycleToStateStatus(params.status),
    priority: inferPriority(params.priority),
    summary: (params.summary ?? params.title ?? "").slice(0, 500) || "Untitled situation",
    actionStatus: params.actionStatus,
    documentRefs: [...(params.documentIds ?? [])],
    careSessionId: params.careSessionId,
    userId: params.userId,
    createdAt: params.createdAt ?? now,
    updatedAt: params.updatedAt ?? now,
  };
}

export function isOperationallyActive(situation: StateSituation): boolean {
  return situation.status === "active";
}
