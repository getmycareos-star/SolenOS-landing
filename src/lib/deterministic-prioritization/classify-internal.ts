import {
  CLASSIFY_BOTTOM_FRACTION,
  CLASSIFY_TOP_FRACTION,
} from "./contract-constants";
import type { InternalPriorityBucket, ScoredIssue } from "./types";

/**
 * Internal classification for compression — NOT exposed in public JSON.
 * - DO_FIRST: top 20%
 * - SAFE_TO_DELAY: middle 50%
 * - WATCH_CLOSELY: bottom 30% or uncertain
 *
 * Classification uses position after score-desc order (pre HIGH_IMPACT sort);
 * callers should pass score-sorted issues. Final rank() may re-order by
 * HIGH_IMPACT first while preserving bucket labels assigned here.
 */

export function classifyInternalBucket(
  index: number,
  total: number,
  uncertain: boolean,
): InternalPriorityBucket {
  if (total <= 0) return "WATCH_CLOSELY";
  if (uncertain) return "WATCH_CLOSELY";

  const doFirstCount = Math.max(1, Math.ceil(total * CLASSIFY_TOP_FRACTION));
  const watchStart = Math.floor(total * (1 - CLASSIFY_BOTTOM_FRACTION));

  if (index < doFirstCount) return "DO_FIRST";
  if (index >= watchStart) return "WATCH_CLOSELY";
  return "SAFE_TO_DELAY";
}

/**
 * Assign buckets by score-descending order.
 * Ties broken by title for determinism.
 */
export function assignInternalBuckets(
  scored: readonly ScoredIssue[],
): Map<string, InternalPriorityBucket> {
  const ordered = [...scored].sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
    return a.title.localeCompare(b.title);
  });
  const map = new Map<string, InternalPriorityBucket>();
  for (let i = 0; i < ordered.length; i++) {
    const item = ordered[i]!;
    map.set(item.id, classifyInternalBucket(i, ordered.length, item.uncertain));
  }
  return map;
}
