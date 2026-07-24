import {
  DECISION_SNAPSHOT_KEYS,
  FORBIDDEN_PUBLIC_BUCKET_STRINGS,
  MAX_PRIORITY_SCORE,
  SCORE_WEIGHTS,
} from "./contract-constants";
import { isExactSixFieldSnapshot } from "./compress-to-decision-snapshot";
import { computePriorityScore } from "./score-issue";
import type {
  DeterministicPrioritizationGuaranteeResult,
  DeterministicPrioritizationLayerResult,
  RankedIssue,
} from "./types";

/**
 * System guarantee before accepting engine output:
 * - formula matches SCORE_WEIGHTS
 * - every issue has whyHere / whyNotHigher / whyNotLower
 * - public snapshot has EXACTLY 6 keys
 * - no internal bucket leakage in public text
 * - HIGH_IMPACT sorts before NONE when scores would otherwise conflict
 */

function formulaMatches(issue: RankedIssue): boolean {
  const expected = computePriorityScore(issue.dimensions);
  return issue.priorityScore === expected;
}

function textHasBucketLeak(text: string): boolean {
  const upper = text.toUpperCase();
  return FORBIDDEN_PUBLIC_BUCKET_STRINGS.some((t) =>
    upper.includes(t.toUpperCase()),
  );
}

export function runDeterministicPrioritizationGuarantee(
  layer: DeterministicPrioritizationLayerResult,
): DeterministicPrioritizationGuaranteeResult {
  const violations: string[] = [];

  if (
    SCORE_WEIGHTS.safety !== 3 ||
    SCORE_WEIGHTS.time !== 2 ||
    SCORE_WEIGHTS.cost !== 2 ||
    SCORE_WEIGHTS.reversibility !== 1 ||
    SCORE_WEIGHTS.relief !== 1
  ) {
    violations.push("SCORE_WEIGHTS drift from mandated formula");
  }

  for (const issue of layer.ranked) {
    if (!formulaMatches(issue)) {
      violations.push(`formula mismatch for ${issue.id}`);
    }
    if (issue.priorityScore < 0 || issue.priorityScore > MAX_PRIORITY_SCORE) {
      violations.push(`priorityScore out of bounds for ${issue.id}`);
    }
    if (!issue.explanation?.whyHere?.trim()) {
      violations.push(`missing whyHere for ${issue.id}`);
    }
    if (!issue.explanation?.whyNotHigher?.trim()) {
      violations.push(`missing whyNotHigher for ${issue.id}`);
    }
    if (!issue.explanation?.whyNotLower?.trim()) {
      violations.push(`missing whyNotLower for ${issue.id}`);
    }
  }

  if (!isExactSixFieldSnapshot(layer.snapshot)) {
    violations.push("public snapshot must have exactly 6 Decision Snapshot keys");
  } else {
    const keys = Object.keys(layer.snapshot).sort();
    const expected = [...DECISION_SNAPSHOT_KEYS].sort();
    if (keys.some((k, i) => k !== expected[i])) {
      violations.push("public snapshot key set drift");
    }
  }

  const publicTexts = [
    layer.snapshot.what_is_happening,
    layer.snapshot.what_matters_now,
    layer.snapshot.what_to_ask_next,
    layer.snapshot.what_can_wait,
    ...layer.snapshot.follow_up_items,
  ];
  for (const t of publicTexts) {
    if (textHasBucketLeak(t)) {
      violations.push("internal bucket string leaked into public compress output");
      break;
    }
  }

  // HIGH_IMPACT must appear before any NONE in ranked order
  let sawNone = false;
  for (const issue of layer.ranked) {
    if (issue.prioritySignal === "NONE") sawNone = true;
    if (issue.prioritySignal === "HIGH_IMPACT" && sawNone) {
      violations.push("HIGH_IMPACT must sort before NONE");
      break;
    }
  }

  return { ok: violations.length === 0, violations };
}
