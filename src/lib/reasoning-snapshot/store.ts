import type { ReasoningSnapshot, WriteReasoningSnapshotParams } from "./types";

const snapshotsByScope = new Map<string, ReasoningSnapshot[]>();

/**
 * Capture a reasoning snapshot for audit/trust.
 * Explicitly NOT fed back into Priority / Conflict decision loops.
 */
export function captureReasoningSnapshot(
  params: WriteReasoningSnapshotParams,
): ReasoningSnapshot {
  return Object.freeze({
    situationId: params.situationId.trim(),
    inputsUsed: [...(params.inputsUsed ?? [])],
    assumptionsUsed: [...(params.assumptionsUsed ?? [])],
    missingInfoSnapshot: [...(params.missingInfoSnapshot ?? [])],
    contextWeights: [...(params.contextWeights ?? [])],
    timestamp: params.timestamp ?? new Date().toISOString(),
  });
}

export function appendReasoningSnapshotForScope(
  scopeId: string,
  params: WriteReasoningSnapshotParams,
): ReasoningSnapshot {
  const snap = captureReasoningSnapshot(params);
  const prev = snapshotsByScope.get(scopeId) ?? [];
  snapshotsByScope.set(scopeId, [...prev, snap]);
  return snap;
}

export function listReasoningSnapshots(scopeId: string): readonly ReasoningSnapshot[] {
  return snapshotsByScope.get(scopeId) ?? [];
}

export function resetReasoningSnapshotStore(): void {
  snapshotsByScope.clear();
}
