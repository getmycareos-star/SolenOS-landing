import {
  compressToDecisionSnapshot,
  isExactSixFieldSnapshot,
} from "./compress-to-decision-snapshot";
import { extractIssues } from "./extract-issues";
import { runDeterministicPrioritizationGuarantee } from "./guarantee";
import { rankIssues } from "./rank";
import { scoreIssues } from "./score-issue";
import type {
  DecisionSnapshot,
  DeterministicPrioritizationLayerPayload,
  DeterministicPrioritizationLayerResult,
} from "./types";

export type ProcessDeterministicPrioritizationParams = {
  input: string;
  /** Optional pre-extracted issues (skips heuristic extraction). */
  issues?: Parameters<typeof scoreIssues>[0];
};

/**
 * Full pipeline:
 * extract → score (+ HIGH_IMPACT signal) → classify → explain → rank → compress
 */
export function processDeterministicPrioritization(
  params: ProcessDeterministicPrioritizationParams,
): DeterministicPrioritizationLayerResult {
  const issues = params.issues ?? extractIssues(params.input);
  const scored = scoreIssues(issues);
  const ranked = rankIssues(scored);
  const snapshot = compressToDecisionSnapshot(ranked);

  const partial: DeterministicPrioritizationLayerResult = {
    issues,
    ranked,
    snapshot,
    guarantee: { ok: true, violations: [] },
  };
  const guarantee = runDeterministicPrioritizationGuarantee(partial);
  return { ...partial, guarantee };
}

export function toDeterministicPrioritizationLayerPayload(
  layer: DeterministicPrioritizationLayerResult,
): DeterministicPrioritizationLayerPayload {
  return {
    issueCount: layer.issues.length,
    rankedTitles: layer.ranked.map((i) => i.title),
    prioritySignals: layer.ranked.map((i) => i.prioritySignal),
    scores: layer.ranked.map((i) => ({
      id: i.id,
      title: i.title,
      priorityScore: i.priorityScore,
      prioritySignal: i.prioritySignal,
      internalBucket: i.internalBucket,
      dimensions: i.dimensions,
      explanation: i.explanation,
    })),
    decision_snapshot: layer.snapshot,
    guaranteeOk: layer.guarantee.ok,
  };
}

/**
 * Overlay Case Memory / PRP Decision Snapshot with deterministic compression
 * when the engine ran successfully — public 6 fields only.
 */
export function mergeDecisionSnapshotFromPrioritization(
  existing: DecisionSnapshot,
  layer: DeterministicPrioritizationLayerResult,
): DecisionSnapshot {
  if (!layer.guarantee.ok || layer.ranked.length === 0) return existing;
  if (!isExactSixFieldSnapshot(layer.snapshot)) return existing;
  return layer.snapshot;
}
