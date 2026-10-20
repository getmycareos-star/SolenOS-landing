import { assignInternalBuckets } from "./classify-internal";
import { buildExplanation, assertExplanationComplete } from "./explain";
import type { RankedIssue, ScoredIssue } from "./types";

/**
 * STEP 4 — Final internal ranking.
 * HIGH_IMPACT first, then priorityScore descending (title tie-break).
 * Each ranked issue MUST carry a complete explanation object.
 */

export function compareRanked(a: ScoredIssue, b: ScoredIssue): number {
  const aHit = a.prioritySignal === "HIGH_IMPACT" ? 1 : 0;
  const bHit = b.prioritySignal === "HIGH_IMPACT" ? 1 : 0;
  if (bHit !== aHit) return bHit - aHit;
  if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
  return a.title.localeCompare(b.title);
}

export function rankIssues(scored: readonly ScoredIssue[]): RankedIssue[] {
  const buckets = assignInternalBuckets(scored);
  const ordered = [...scored].sort(compareRanked);

  return ordered.map((issue, index) => {
    const internalBucket = buckets.get(issue.id) ?? "WATCH_CLOSELY";
    const explanation = buildExplanation(issue, internalBucket);
    assertExplanationComplete(explanation);
    return {
      ...issue,
      rank: index + 1,
      internalBucket,
      explanation,
    };
  });
}
