import { randomUUID } from "node:crypto";

import type { TrackedSituation } from "./types";

export function nowIso(nowMs?: number): string {
  return new Date(nowMs ?? Date.now()).toISOString();
}

export function createSituationId(): string {
  return randomUUID();
}

export function createEmptyTrackedSituation(params: {
  title: string;
  careSessionId: string;
  userId?: string;
  id?: string;
  nowMs?: number;
  timelineEntryIds?: string[];
  memoryNodeIds?: string[];
  documentIds?: string[];
}): TrackedSituation {
  const ts = nowIso(params.nowMs);
  return {
    id: params.id ?? createSituationId(),
    title: params.title.slice(0, 200) || "Untitled situation",
    status: "ACTIVE",
    careSessionId: params.careSessionId,
    userId: params.userId,
    createdAt: ts,
    updatedAt: ts,
    lastReevaluatedAt: ts,
    timelineEntryIds: [...(params.timelineEntryIds ?? [])],
    memoryNodeIds: [...(params.memoryNodeIds ?? [])],
    documentIds: [...(params.documentIds ?? [])],
    referencedBySituationIds: [],
    unresolvedDependencyIds: [],
    history: [
      {
        version: 1,
        fromStatus: null,
        toStatus: "ACTIVE",
        at: ts,
        reason: "situation_created",
      },
    ],
  };
}
