import { randomUUID } from "node:crypto";

import type {
  MemoryCategory,
  MemoryDeletionEvent,
  MemoryInfluenceEntry,
  MemoryInfluenceState,
  SolenOSMemory,
} from "./types";

function nowIso(): string {
  return new Date().toISOString();
}

function getCategoryEntries(
  memory: SolenOSMemory,
  category: MemoryCategory,
): MemoryInfluenceEntry[] {
  switch (category) {
    case "identity":
      return memory.identityMemory.entries;
    case "patterns":
      return memory.longTermPatternMemory.entries;
    case "operational":
      return memory.operationalMemory.entries;
    case "emotional":
      return memory.emotionalMemory.entries;
    default:
      return [];
  }
}

function setCategoryEntries(
  memory: SolenOSMemory,
  category: MemoryCategory,
  entries: MemoryInfluenceEntry[],
): SolenOSMemory {
  switch (category) {
    case "identity":
      return { ...memory, identityMemory: { entries } };
    case "patterns":
      return { ...memory, longTermPatternMemory: { entries } };
    case "operational":
      return { ...memory, operationalMemory: { entries } };
    case "emotional":
      return { ...memory, emotionalMemory: { entries } };
    default:
      return memory;
  }
}

function reconcileCounts(
  state: MemoryInfluenceState,
  removedKeys: readonly string[],
): Record<string, number> {
  const counts = { ...state.signalOccurrenceCounts };
  for (const key of removedKeys) {
    delete counts[key];
  }
  return counts;
}

export type MemoryDeletionResult = {
  state: MemoryInfluenceState;
  event: MemoryDeletionEvent;
};

/**
 * Deletion is NOT immediate erasure — log event, reconcile inference model, remove influence weights.
 */
export function deleteMemoryEntry(
  state: MemoryInfluenceState,
  category: MemoryCategory,
  entryId: string,
  reason: string,
): MemoryDeletionResult | null {
  if (!state.memory.deletionPolicy.allowSelectiveForget) return null;

  const entries = getCategoryEntries(state.memory, category);
  const target = entries.find((e) => e.id === entryId);
  if (!target) return null;

  const remaining = entries.filter((e) => e.id !== entryId);
  const event: MemoryDeletionEvent = {
    id: randomUUID(),
    deletedAt: nowIso(),
    category,
    entryId,
    reason,
    reconciled: true,
  };

  return {
    state: {
      ...state,
      memory: setCategoryEntries(state.memory, category, remaining),
      signalOccurrenceCounts: reconcileCounts(state, [target.key]),
      deletionLog: [...state.deletionLog, event],
    },
    event,
  };
}

export function deleteMemoryCategory(
  state: MemoryInfluenceState,
  category: MemoryCategory,
  reason: string,
): MemoryDeletionResult | null {
  if (!state.memory.deletionPolicy.allowCategoryDelete) return null;

  const removedKeys = getCategoryEntries(state.memory, category).map((e) => e.key);
  const event: MemoryDeletionEvent = {
    id: randomUUID(),
    deletedAt: nowIso(),
    category,
    reason,
    reconciled: true,
  };

  return {
    state: {
      ...state,
      memory: setCategoryEntries(state.memory, category, []),
      signalOccurrenceCounts: reconcileCounts(state, removedKeys),
      deletionLog: [...state.deletionLog, event],
    },
    event,
  };
}

export function deleteAllMemoryInfluence(
  state: MemoryInfluenceState,
  reason: string,
): MemoryDeletionResult | null {
  if (!state.memory.deletionPolicy.allowFullDelete) return null;

  const allKeys = [
    ...state.memory.identityMemory.entries,
    ...state.memory.longTermPatternMemory.entries,
    ...state.memory.operationalMemory.entries,
    ...state.memory.emotionalMemory.entries,
  ].map((e) => e.key);

  const event: MemoryDeletionEvent = {
    id: randomUUID(),
    deletedAt: nowIso(),
    reason,
    reconciled: true,
  };

  return {
    state: {
      ...state,
      memory: {
        ...state.memory,
        identityMemory: { entries: [] },
        longTermPatternMemory: { entries: [] },
        operationalMemory: { entries: [] },
        emotionalMemory: { entries: [] },
      },
      signalOccurrenceCounts: reconcileCounts(state, allKeys),
      deletionLog: [...state.deletionLog, event],
    },
    event,
  };
}

export function tagMemoryEntry(
  state: MemoryInfluenceState,
  category: MemoryCategory,
  entryId: string,
  tags: Partial<{ outdated: boolean; incorrect: boolean; sensitive: boolean }>,
): MemoryInfluenceState {
  const entries = getCategoryEntries(state.memory, category).map((entry) => {
    if (entry.id !== entryId) return entry;
    return {
      ...entry,
      tags: { ...entry.tags, ...tags },
      influenceWeight: tags.incorrect ? 0 : entry.influenceWeight,
    };
  });

  return {
    ...state,
    memory: setCategoryEntries(state.memory, category, entries),
  };
}
