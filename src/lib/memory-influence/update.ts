import { randomUUID } from "node:crypto";

import {
  MEMORY_INFERENCE_CONFIDENCE_THRESHOLD,
  MEMORY_SIGNAL_REPEAT_THRESHOLD,
} from "./contract-constants";
import { detectMemoryInfluenceSignals, signalOccurrenceKey } from "./signals";
import type {
  MemoryCategory,
  MemoryInfluenceEntry,
  MemoryInfluenceSignal,
  MemoryInfluenceState,
  MemoryUpdateCondition,
  SolenOSMemory,
} from "./types";

function nowIso(): string {
  return new Date().toISOString();
}

function categoryEnabled(memory: SolenOSMemory, category: MemoryCategory): boolean {
  switch (category) {
    case "identity":
      return memory.memoryWeights.identity > 0;
    case "patterns":
      return memory.memoryWeights.patterns > 0;
    case "operational":
      return memory.memoryWeights.operational > 0;
    case "emotional":
      return memory.memoryWeights.emotional > 0;
    default:
      return false;
  }
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

function resolveUpdateCondition(
  signal: MemoryInfluenceSignal,
  occurrenceCount: number,
): MemoryUpdateCondition | null {
  if (signal.userConfirmed) {
    return "USER_CONFIRMED";
  }
  if (occurrenceCount >= MEMORY_SIGNAL_REPEAT_THRESHOLD) {
    return "REPEATED_PATTERN";
  }
  if (
    signal.category === "operational" &&
    signal.confidence > MEMORY_INFERENCE_CONFIDENCE_THRESHOLD
  ) {
    return "HIGH_CONFIDENCE";
  }
  return null;
}

function createEntry(
  signal: MemoryInfluenceSignal,
  occurrenceCount: number,
  source: MemoryUpdateCondition,
): MemoryInfluenceEntry {
  const ts = nowIso();
  return {
    id: randomUUID(),
    key: signalOccurrenceKey(signal),
    influenceLabel: signal.influenceLabel,
    influenceWeight: Math.min(1, signal.confidence * (source === "USER_CONFIRMED" ? 1 : 0.85)),
    confidence: signal.confidence,
    occurrenceCount,
    tags: { outdated: false, incorrect: false, sensitive: false },
    source,
    createdAt: ts,
    updatedAt: ts,
  };
}

function upsertEntry(
  entries: MemoryInfluenceEntry[],
  signal: MemoryInfluenceSignal,
  occurrenceCount: number,
  source: MemoryUpdateCondition,
): MemoryInfluenceEntry[] {
  const key = signalOccurrenceKey(signal);
  const existingIdx = entries.findIndex((e) => e.key === key && !e.tags.incorrect);
  const ts = nowIso();

  if (existingIdx >= 0) {
    const existing = entries[existingIdx];
    const updated: MemoryInfluenceEntry = {
      ...existing,
      occurrenceCount,
      confidence: Math.max(existing.confidence, signal.confidence),
      influenceWeight: Math.min(
        1,
        Math.max(existing.influenceWeight, signal.confidence * 0.85),
      ),
      updatedAt: ts,
      source,
    };
    const next = [...entries];
    next[existingIdx] = updated;
    return next;
  }

  return [...entries, createEntry(signal, occurrenceCount, source)];
}

export type MemoryUpdateResult = {
  state: MemoryInfluenceState;
  appliedUpdates: MemoryInfluenceEntry[];
};

/**
 * Apply memory update rules — ONLY when repeated pattern, user confirmed, or high confidence.
 * Single-instance events are counted but not promoted to long-term memory without conditions.
 */
export function applyMemoryInfluenceSignals(
  state: MemoryInfluenceState,
  signals: MemoryInfluenceSignal[],
  options: { inferenceAllowed: boolean },
): MemoryUpdateResult {
  if (!options.inferenceAllowed || signals.length === 0) {
    return { state, appliedUpdates: [] };
  }

  if (!state.memory.inferenceFromBehavior && signals.every((s) => !s.userConfirmed)) {
    return { state, appliedUpdates: [] };
  }

  const counts = { ...state.signalOccurrenceCounts };
  let memory = state.memory;
  const appliedUpdates: MemoryInfluenceEntry[] = [];

  for (const signal of signals) {
    if (!categoryEnabled(memory, signal.category)) continue;

    const key = signalOccurrenceKey(signal);
    counts[key] = (counts[key] ?? 0) + 1;
    const occurrenceCount = counts[key];

    const condition = resolveUpdateCondition(signal, occurrenceCount);
    if (!condition) continue;

    if (
      signal.category === "identity" &&
      condition !== "USER_CONFIRMED" &&
      occurrenceCount < MEMORY_SIGNAL_REPEAT_THRESHOLD
    ) {
      continue;
    }

    const before = getCategoryEntries(memory, signal.category);
    const after = upsertEntry(before, signal, occurrenceCount, condition);
    if (after.length !== before.length || JSON.stringify(after) !== JSON.stringify(before)) {
      memory = setCategoryEntries(memory, signal.category, after);
      const entry = after.find((e) => e.key === key);
      if (entry) appliedUpdates.push(entry);
    }
  }

  return {
    state: { ...state, memory, signalOccurrenceCounts: counts },
    appliedUpdates,
  };
}

export function processInputForMemoryUpdate(
  state: MemoryInfluenceState,
  input: string,
  options: { inferenceAllowed: boolean },
): MemoryUpdateResult {
  const signals = detectMemoryInfluenceSignals(input);
  return applyMemoryInfluenceSignals(state, signals, options);
}
