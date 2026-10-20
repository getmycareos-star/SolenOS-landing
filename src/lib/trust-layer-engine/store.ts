import type { TrustLayerBlock } from "./types";

const snapshots = new Map<string, TrustLayerBlock[]>();

export function recordTrustSnapshot(caregiverId: string, block: TrustLayerBlock): void {
  const prior = snapshots.get(caregiverId) ?? [];
  snapshots.set(caregiverId, [...prior.slice(-19), block]);
}

export function getTrustSnapshots(caregiverId: string): TrustLayerBlock[] {
  return snapshots.get(caregiverId) ?? [];
}

export function resetTrustLayerEngineStore(): void {
  snapshots.clear();
}
