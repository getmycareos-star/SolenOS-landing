import type { SolenOSStore, StateSnapshot } from "./types";

export function getLatestSnapshot(
  store: SolenOSStore,
  sessionId: string,
): StateSnapshot | undefined {
  const snaps = store.snapshots
    .filter((s) => s.session_id === sessionId)
    .sort((a, b) => b.event_offset - a.event_offset);
  return snaps[0];
}
