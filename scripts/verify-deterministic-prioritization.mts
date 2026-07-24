/**
 * verify-deterministic-prioritization.mts
 *
 * Asserts SolenOS Deterministic Prioritization Engine MVP:
 * - formula correct
 * - classification percentages
 * - every issue has whyHere / whyNotHigher / whyNotLower
 * - public compress has EXACTLY 6 keys
 * - grandmother example: electrical / dental above laundry / repaint
 * - what_matters_now ≤ 3 actions
 * - no DO_FIRST strings in public output
 * - HIGH_IMPACT override sorts first
 */

import {
  CLASSIFY_BOTTOM_FRACTION,
  CLASSIFY_MIDDLE_FRACTION,
  CLASSIFY_TOP_FRACTION,
  DECISION_SNAPSHOT_KEYS,
  DETERMINISTIC_PRIORITIZATION_FORBIDDEN,
  DETERMINISTIC_PRIORITIZATION_IDENTITY,
  DETERMINISTIC_PRIORITIZATION_ONE_LINE_TRUTH,
  DETERMINISTIC_PRIORITIZATION_PIPELINE_POSITION,
  FORBIDDEN_PUBLIC_BUCKET_STRINGS,
  MAX_MATTERS_NOW_ACTIONS,
  MAX_PRIORITY_SCORE,
  SCORE_WEIGHTS,
  VS_PRIORITY_CONTRACT,
  assignInternalBuckets,
  classifyInternalBucket,
  compressToDecisionSnapshot,
  computePriorityScore,
  countMattersNowActions,
  extractIssues,
  isExactSixFieldSnapshot,
  processDeterministicPrioritization,
  rankIssues,
  scoreIssue,
  scoreIssues,
  type DimensionScores,
  type Issue,
} from "../src/lib/deterministic-prioritization";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== SolenOS Deterministic Prioritization Engine ===\n");

// ─── Contract constants ───────────────────────────────────────────────────────
assert(
  DETERMINISTIC_PRIORITIZATION_IDENTITY.includes("SolenOS"),
  "identity must name SolenOS",
);
assert(
  !DETERMINISTIC_PRIORITIZATION_IDENTITY.toLowerCase().includes("care" + "os"),
  "identity must not use purged legacy product brand",
);
assert(
  DETERMINISTIC_PRIORITIZATION_ONE_LINE_TRUTH.includes("six public fields") ||
    DETERMINISTIC_PRIORITIZATION_ONE_LINE_TRUTH.includes("six"),
  "one-line truth must mention six-field public contract",
);
assert(
  DETERMINISTIC_PRIORITIZATION_PIPELINE_POSITION.includes("Priority Engine") ||
    DETERMINISTIC_PRIORITIZATION_PIPELINE_POSITION.includes("before final"),
  "pipeline position must sit before final assembly",
);
assert(
  DETERMINISTIC_PRIORITIZATION_FORBIDDEN.some((f) => f.includes("DO_FIRST")),
  "must forbid leaking DO_FIRST",
);
assert(VS_PRIORITY_CONTRACT.includes("Priority Contract"), "vs Priority Contract note");
console.log("✓ contract constants");

// ─── Formula ─────────────────────────────────────────────────────────────────
assert(SCORE_WEIGHTS.safety === 3, "safety weight");
assert(SCORE_WEIGHTS.time === 2, "time weight");
assert(SCORE_WEIGHTS.cost === 2, "cost weight");
assert(SCORE_WEIGHTS.reversibility === 1, "reversibility weight");
assert(SCORE_WEIGHTS.relief === 1, "relief weight");
assert(MAX_PRIORITY_SCORE === 27, "max score");

const dims: DimensionScores = {
  safety: 3,
  time: 2,
  cost: 1,
  reversibility: 2,
  relief: 3,
};
assert(
  computePriorityScore(dims) === 3 * 3 + 2 * 2 + 1 * 2 + 2 * 1 + 3 * 1,
  "formula evaluation",
);
assert(computePriorityScore(dims) === 20, "formula numeric");
console.log("✓ formula correct");

// ─── Classification percentages ───────────────────────────────────────────────
assert(CLASSIFY_TOP_FRACTION === 0.2, "top 20%");
assert(CLASSIFY_MIDDLE_FRACTION === 0.5, "middle 50%");
assert(CLASSIFY_BOTTOM_FRACTION === 0.3, "bottom 30%");

const n = 10;
const buckets = Array.from({ length: n }, (_, i) =>
  classifyInternalBucket(i, n, false),
);
const doFirst = buckets.filter((b) => b === "DO_FIRST").length;
const delay = buckets.filter((b) => b === "SAFE_TO_DELAY").length;
const watch = buckets.filter((b) => b === "WATCH_CLOSELY").length;
assert(doFirst === Math.ceil(n * 0.2), `DO_FIRST count for n=10 expected 2 got ${doFirst}`);
assert(watch === n - Math.floor(n * 0.7), `WATCH count for n=10 expected 3 got ${watch}`);
assert(delay === n - doFirst - watch, `SAFE_TO_DELAY residual got ${delay}`);
assert(classifyInternalBucket(0, 5, true) === "WATCH_CLOSELY", "uncertain → WATCH_CLOSELY");
console.log("✓ classification percentages");

// ─── Explanations required ────────────────────────────────────────────────────
const sampleIssues: Issue[] = [
  { id: "a", title: "exposed wiring sparks when plugging in", context: "grandmother home safety" },
  { id: "b", title: "terrible tooth pain for days", context: "grandmother health" },
  { id: "c", title: "laundry piled up", context: "household" },
  { id: "d", title: "hallway needs repainting", context: "cosmetic" },
];
const rankedSample = rankIssues(scoreIssues(sampleIssues));
for (const issue of rankedSample) {
  assert(issue.explanation.whyHere.trim().length > 0, `whyHere ${issue.id}`);
  assert(issue.explanation.whyNotHigher.trim().length > 0, `whyNotHigher ${issue.id}`);
  assert(issue.explanation.whyNotLower.trim().length > 0, `whyNotLower ${issue.id}`);
}
console.log("✓ every issue has whyHere / whyNotHigher / whyNotLower");

// ─── Public compress exactly 6 keys ───────────────────────────────────────────
const snap = compressToDecisionSnapshot(rankedSample);
assert(isExactSixFieldSnapshot(snap), "exact six-field snapshot");
const keys = Object.keys(snap).sort();
const expected = [...DECISION_SNAPSHOT_KEYS].sort();
assert(
  keys.length === 6 && keys.every((k, i) => k === expected[i]),
  `keys must match DECISION_SNAPSHOT_KEYS got ${keys.join(",")}`,
);
assert(!("internalBucket" in snap), "no internalBucket on public");
assert(!("priorityScore" in snap), "no priorityScore on public");
console.log("✓ public compress has EXACTLY 6 keys");

// ─── Grandmother example ──────────────────────────────────────────────────────
const grandmotherInput =
  "My grandmother has exposed wiring that sparks when she plugs things in, " +
  "she's been complaining about terrible tooth pain for days, " +
  "there's laundry piled up, and the hallway needs repainting.";

const layer = processDeterministicPrioritization({ input: grandmotherInput });
assert(layer.guarantee.ok, `guarantee failed: ${layer.guarantee.violations.join("; ")}`);
assert(layer.ranked.length >= 3, "should extract multiple issues");

const byTitle = (re: RegExp) => layer.ranked.find((i) => re.test(i.title));
const electrical = byTitle(/electr|sparks?|wir/i);
const dental = byTitle(/tooth|dental|pain/i);
const laundry = byTitle(/laundry/i);
const paint = byTitle(/paint|repaint|hallway/i);

assert(electrical, "electrical hazard issue extracted");
assert(dental, "dental/pain issue extracted");
assert(laundry || paint, "low-urgency household issue extracted");

assert(
  electrical!.priorityScore > (laundry?.priorityScore ?? 0),
  `electrical (${electrical!.priorityScore}) must score above laundry (${laundry?.priorityScore ?? "n/a"})`,
);
assert(
  electrical!.priorityScore > (paint?.priorityScore ?? 0),
  `electrical (${electrical!.priorityScore}) must score above repaint (${paint?.priorityScore ?? "n/a"})`,
);
assert(
  dental!.priorityScore > (laundry?.priorityScore ?? 0),
  `dental (${dental!.priorityScore}) must score above laundry (${laundry?.priorityScore ?? "n/a"})`,
);
assert(
  dental!.priorityScore > (paint?.priorityScore ?? 0),
  `dental (${dental!.priorityScore}) must score above repaint (${paint?.priorityScore ?? "n/a"})`,
);

const actions = countMattersNowActions(layer.snapshot.what_matters_now);
assert(
  actions > 0 && actions <= MAX_MATTERS_NOW_ACTIONS,
  `what_matters_now actions ${actions} must be 1..${MAX_MATTERS_NOW_ACTIONS}`,
);

const publicBlob = [
  layer.snapshot.what_is_happening,
  layer.snapshot.what_matters_now,
  layer.snapshot.what_to_ask_next,
  layer.snapshot.what_can_wait,
  ...layer.snapshot.follow_up_items,
].join("\n");
for (const forbidden of FORBIDDEN_PUBLIC_BUCKET_STRINGS) {
  assert(
    !publicBlob.toUpperCase().includes(forbidden.toUpperCase()),
    `public output must not contain "${forbidden}"`,
  );
}
console.log("✓ grandmother example scoring + compress constraints");

// ─── HIGH_IMPACT sorts first ──────────────────────────────────────────────────
assert(
  electrical!.prioritySignal === "HIGH_IMPACT" || dental!.prioritySignal === "HIGH_IMPACT",
  "electrical or dental must be HIGH_IMPACT",
);
let sawNone = false;
for (const issue of layer.ranked) {
  if (issue.prioritySignal === "NONE") sawNone = true;
  if (issue.prioritySignal === "HIGH_IMPACT") {
    assert(!sawNone, "HIGH_IMPACT must sort before NONE");
  }
}
const first = layer.ranked[0]!;
assert(first.prioritySignal === "HIGH_IMPACT", "rank #1 must be HIGH_IMPACT");
console.log("✓ HIGH_IMPACT override sorts first");

// ─── Bucket map consistency + extract ─────────────────────────────────────────
const extracted = extractIssues(grandmotherInput);
assert(extracted.length >= 3, "extractIssues volume");
const scored = scoreIssues(extracted);
const map = assignInternalBuckets(scored);
assert(map.size === scored.length, "bucket map covers all");
const scoredOne = scoreIssue(extracted[0]!);
assert(
  scoredOne.priorityScore === computePriorityScore(scoredOne.dimensions),
  "scoreIssue formula tie",
);
console.log("✓ extract + bucket map");

console.log("\n=== Deterministic Prioritization: PASS ===");
