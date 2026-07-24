import type { SuccessSnapshot } from "./types";

const snapshots = new Map<string, SuccessSnapshot[]>();

export function recordSuccessSnapshot(snapshot: SuccessSnapshot): void {
  const list = snapshots.get(snapshot.caregiver_id) ?? [];
  list.push(snapshot);
  snapshots.set(snapshot.caregiver_id, list);
}

export function getLatestSnapshot(caregiverId: string): SuccessSnapshot | null {
  const list = snapshots.get(caregiverId);
  if (!list || list.length === 0) return null;
  return list[list.length - 1]!;
}

export function getSnapshotHistory(caregiverId: string): SuccessSnapshot[] {
  return [...(snapshots.get(caregiverId) ?? [])];
}

export function resetSuccessModelStore(): void {
  snapshots.clear();
}
