import type { BeliefItem, BeliefItemType, BeliefStoreSnapshot } from "../types";
import { createBeliefItem } from "./map";

/** Canonical BELIEF store — unifies assumptions + missing information. Keyed by userId. */
const beliefsByUserId = new Map<string, BeliefItem[]>();

export function resetBeliefStore(): void {
  beliefsByUserId.clear();
}

export function getBeliefSnapshot(userId: string): BeliefStoreSnapshot {
  return {
    userId,
    items: [...(beliefsByUserId.get(userId) ?? [])],
  };
}

export function setBeliefItems(
  userId: string,
  items: readonly BeliefItem[],
): BeliefStoreSnapshot {
  beliefsByUserId.set(userId, [...items]);
  return getBeliefSnapshot(userId);
}

export function listBeliefs(
  userId: string,
  filters?: {
    situationId?: string;
    type?: BeliefItemType;
    status?: BeliefItem["status"];
  },
): readonly BeliefItem[] {
  let items = beliefsByUserId.get(userId) ?? [];
  if (filters?.situationId !== undefined) {
    items = items.filter((i) => i.situationId === filters.situationId);
  }
  if (filters?.type !== undefined) {
    items = items.filter((i) => i.type === filters.type);
  }
  if (filters?.status !== undefined) {
    items = items.filter((i) => i.status === filters.status);
  }
  return [...items];
}

export function upsertBelief(userId: string, item: BeliefItem): BeliefItem {
  const items = [...(beliefsByUserId.get(userId) ?? [])];
  const idx = items.findIndex(
    (i) =>
      i.id === item.id ||
      (item.legacyAssumptionId && i.legacyAssumptionId === item.legacyAssumptionId) ||
      (item.legacyMissingInfoId && i.legacyMissingInfoId === item.legacyMissingInfoId),
  );
  if (idx === -1) {
    items.push(item);
  } else {
    items[idx] = item;
  }
  beliefsByUserId.set(userId, items);
  return item;
}

export function addBelief(
  userId: string,
  params: Parameters<typeof createBeliefItem>[0],
): BeliefItem {
  const existing = listBeliefs(userId, {
    situationId: params.situationId,
    type: params.type,
    status: "active",
  });
  const duplicate = existing.find(
    (i) => i.content.toLowerCase() === params.content.trim().toLowerCase(),
  );
  if (duplicate) return duplicate;
  const item = createBeliefItem(params);
  return upsertBelief(userId, item);
}

export function updateBeliefStatus(
  userId: string,
  beliefId: string,
  status: BeliefItem["status"],
): BeliefItem | undefined {
  const items = beliefsByUserId.get(userId) ?? [];
  const idx = items.findIndex((i) => i.id === beliefId);
  if (idx === -1) return undefined;
  const next = {
    ...items[idx]!,
    status,
    updatedAt: new Date().toISOString(),
  };
  items[idx] = next;
  beliefsByUserId.set(userId, items);
  return next;
}

export function listActiveAssumptions(userId: string, situationId?: string) {
  return listBeliefs(userId, {
    type: "assumption",
    status: "active",
    situationId,
  }).concat(
    listBeliefs(userId, {
      type: "assumption",
      status: "confirmed",
      situationId,
    }),
  );
}

export function listActiveMissingInformation(
  userId: string,
  situationId?: string,
) {
  return listBeliefs(userId, {
    type: "missing_information",
    status: "active",
    situationId,
  });
}

/**
 * HIGH importance missing_information beliefs block high-confidence irreversible decisions.
 */
export function hasHighImportanceMissingInformation(
  userId: string,
  situationId?: string,
): boolean {
  return listActiveMissingInformation(userId, situationId).some(
    (i) => i.importance === "HIGH",
  );
}

export function countHighImportanceMissingInformation(
  beliefs: readonly BeliefItem[],
): number {
  return beliefs.filter(
    (i) =>
      i.type === "missing_information" &&
      i.status === "active" &&
      i.importance === "HIGH",
  ).length;
}
