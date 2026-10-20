import type { MemoryRecord } from "./types";

const store = new Map<string, MemoryRecord[]>();

export function getMemoryRecords(caregiverId: string): MemoryRecord[] {
  return store.get(caregiverId) ?? [];
}

export function saveMemoryRecords(caregiverId: string, records: MemoryRecord[]): void {
  store.set(caregiverId, records);
}

export function resetMemoryStrategyStore(): void {
  store.clear();
}
