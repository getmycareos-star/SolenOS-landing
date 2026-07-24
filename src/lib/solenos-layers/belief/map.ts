import { randomUUID } from "node:crypto";
import type {
  BeliefImportance,
  BeliefItem,
  BeliefItemStatus,
  BeliefItemType,
} from "../types";

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function createBeliefItem(params: {
  situationId: string;
  type: BeliefItemType;
  content: string;
  confidence?: number;
  importance?: BeliefImportance;
  status?: BeliefItemStatus;
  id?: string;
  legacyAssumptionId?: string;
  legacyMissingInfoId?: string;
  nowMs?: number;
}): BeliefItem {
  const nowIso = new Date(params.nowMs ?? Date.now()).toISOString();
  return {
    id: params.id ?? randomUUID(),
    situationId: params.situationId,
    type: params.type,
    content: params.content.trim(),
    confidence: clamp01(params.confidence ?? (params.type === "assumption" ? 0.7 : 0.5)),
    importance: params.importance,
    status: params.status ?? "active",
    createdAt: nowIso,
    updatedAt: nowIso,
    legacyAssumptionId: params.legacyAssumptionId,
    legacyMissingInfoId: params.legacyMissingInfoId,
  };
}

/** Map legacy assumption status → BeliefItem status. */
export function mapAssumptionStatusToBelief(
  status: string,
): BeliefItemStatus {
  switch (status) {
    case "validated":
    case "confirmed":
      return "confirmed";
    case "invalidated":
    case "expired":
      return "invalidated";
    case "active":
    default:
      return "active";
  }
}

/** Map BeliefItem status → legacy assumption status (validated ≈ confirmed). */
export function mapBeliefStatusToAssumption(
  status: BeliefItemStatus,
): "active" | "validated" | "invalidated" {
  switch (status) {
    case "confirmed":
      return "validated";
    case "invalidated":
      return "invalidated";
    case "active":
      return "active";
  }
}

/** Map legacy missing-info status → BeliefItem status. */
export function mapMissingInfoStatusToBelief(
  status: string,
): BeliefItemStatus {
  switch (status) {
    case "resolved":
    case "confirmed":
      return "confirmed";
    case "expired":
    case "invalidated":
      return "invalidated";
    case "open":
    case "active":
    default:
      return "active";
  }
}

export function mapBeliefStatusToMissingInfo(
  status: BeliefItemStatus,
): "open" | "resolved" | "expired" {
  switch (status) {
    case "confirmed":
      return "resolved";
    case "invalidated":
      return "expired";
    case "active":
      return "open";
  }
}

export function assumptionToBeliefItem(params: {
  assumptionId: string;
  statement: string;
  relatedSituationId?: string;
  status: string;
  confidence: number;
  createdAt: string;
  lastCheckedAt?: string;
}): BeliefItem {
  return {
    id: params.assumptionId,
    situationId: params.relatedSituationId ?? "unscoped",
    type: "assumption",
    content: params.statement,
    confidence: clamp01(params.confidence),
    status: mapAssumptionStatusToBelief(params.status),
    createdAt: params.createdAt,
    updatedAt: params.lastCheckedAt ?? params.createdAt,
    legacyAssumptionId: params.assumptionId,
  };
}

export function missingInfoToBeliefItem(params: {
  id: string;
  situationId: string;
  question: string;
  importance: BeliefImportance;
  status: string;
  createdAt: string;
  resolvedAt?: string;
}): BeliefItem {
  return {
    id: params.id,
    situationId: params.situationId,
    type: "missing_information",
    content: params.question,
    confidence: 0.5,
    importance: params.importance,
    status: mapMissingInfoStatusToBelief(params.status),
    createdAt: params.createdAt,
    updatedAt: params.resolvedAt ?? params.createdAt,
    legacyMissingInfoId: params.id,
  };
}
