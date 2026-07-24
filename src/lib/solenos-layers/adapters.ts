/**
 * Legacy ↔ Layer adapters — keep old module APIs working while STATE/BELIEF own persistence.
 */

import {
  assumptionToBeliefItem,
  missingInfoToBeliefItem,
  setBeliefItems,
} from "./belief";
import {
  replaceStateSituations,
  toStateSituation,
} from "./state";
import type { BeliefItem, StateSituation } from "./types";

/** Sync resolution TrackedSituation[] into canonical STATE. */
export function syncTrackedSituationsToState(
  careSessionId: string,
  tracked: readonly {
    id: string;
    title: string;
    status: string;
    documentIds?: readonly string[];
    userId?: string;
    createdAt: string;
    updatedAt: string;
  }[],
  options?: { priority?: string; summary?: string },
): readonly StateSituation[] {
  const mapped = tracked.map((t) =>
    toStateSituation({
      id: t.id,
      status: t.status,
      title: t.title,
      summary: options?.summary ?? t.title,
      priority: options?.priority,
      documentIds: t.documentIds,
      careSessionId,
      userId: t.userId,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }),
  );
  return replaceStateSituations(careSessionId, mapped);
}

/** Sync Assumption[] + MissingInformationItem[] into unified BELIEF store. */
export function syncLegacyBeliefsToStore(params: {
  userId: string;
  assumptions?: readonly {
    assumptionId: string;
    statement: string;
    relatedSituationId?: string;
    status: string;
    confidence: number;
    createdAt: string;
    lastCheckedAt?: string;
  }[];
  missingInformation?: readonly {
    id: string;
    situationId: string;
    question: string;
    importance: "LOW" | "MEDIUM" | "HIGH";
    status: string;
    createdAt: string;
    resolvedAt?: string;
  }[];
}): readonly BeliefItem[] {
  const items: BeliefItem[] = [];

  for (const a of params.assumptions ?? []) {
    items.push(
      assumptionToBeliefItem({
        assumptionId: a.assumptionId,
        statement: a.statement,
        relatedSituationId: a.relatedSituationId,
        status: a.status,
        confidence: a.confidence,
        createdAt: a.createdAt,
        lastCheckedAt: a.lastCheckedAt,
      }),
    );
  }

  for (const m of params.missingInformation ?? []) {
    items.push(
      missingInfoToBeliefItem({
        id: m.id,
        situationId: m.situationId,
        question: m.question,
        importance: m.importance,
        status: m.status,
        createdAt: m.createdAt,
        resolvedAt: m.resolvedAt,
      }),
    );
  }

  return setBeliefItems(params.userId, items).items;
}
