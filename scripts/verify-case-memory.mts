import fs from "node:fs";
import path from "node:path";
import {
  CASE_DECISION_SNAPSHOT_KEYS,
  CASE_MEMORY_LAYER_FORBIDDEN,
  CASE_MEMORY_LAYER_IDENTITY,
  CASE_MEMORY_LAYER_PIPELINE_POSITION,
  CASE_VS_SITUATION_MAPPING,
  assembleDecisionSnapshot,
  extractFacts,
  isExactDecisionSnapshotSchema,
  listsMultiplePastDates,
  processCaseMemoryLayer,
  resetCaseMemoryStores,
  toCaseMemoryLayerPayload,
} from "../src/lib/case-memory";
import {
  CASE_MEMORY_PRODUCT,
  SITUATION_ROOT_ENTITY,
} from "../src/lib/solenos-layers/architecture-map";

console.log("=== Case Memory + Pattern Response Policy ===\n");

if (!CASE_MEMORY_LAYER_IDENTITY.includes("Case-centered")) {
  throw new Error("case memory identity drift");
}
if (!CASE_MEMORY_LAYER_FORBIDDEN.some((r) => r.includes("conversations"))) {
  throw new Error("must forbid conversation-as-primary-memory");
}
if (!CASE_MEMORY_LAYER_PIPELINE_POSITION.includes("identify Case")) {
  throw new Error("pipeline position must include identify Case");
}
if (!CASE_VS_SITUATION_MAPPING.rule.includes("Situations are operational")) {
  throw new Error("Case vs Situation mapping drift");
}
if (!CASE_MEMORY_PRODUCT.canonicalPath.includes("case-memory")) {
  throw new Error("architecture-map CASE_MEMORY_PRODUCT missing");
}
if (!SITUATION_ROOT_ENTITY.caseProductSpine?.includes("case-memory")) {
  throw new Error("SITUATION_ROOT_ENTITY must point at Case product spine");
}
console.log("✓ contract constants + architecture map");

resetCaseMemoryStores();

// --- Condition persists on Case ---
const parkinson = processCaseMemoryLayer({
  input: "Dad has Parkinson's",
  now: "2026-06-12T15:00:00.000Z",
});
if (!parkinson.caseEntity.conditions.some((c) => /parkinson/i.test(c.name))) {
  throw new Error("Dad has Parkinson's must persist as Condition on Case");
}
if (parkinson.caseEntity.profile.displayName === "Dad") {
  throw new Error("must not silently create displayName Dad from note (identity Locked A)");
}
if (parkinson.caseEntity.profile.displayName !== "Care recipient") {
  throw new Error("unset identity should use neutral Care recipient case");
}
if (parkinson.policy.state !== "A") {
  throw new Error("first Parkinson's note without history should be State A");
}
console.log("✓ Parkinson's persists as Condition; no silent Dad identity");

// --- State A: no match / no history phrases ---
resetCaseMemoryStores();
const novel = processCaseMemoryLayer({
  input: "Mom felt a little tired after lunch",
  now: "2026-07-01T18:00:00.000Z",
});
if (novel.policy.state !== "A" || novel.policy.matchStrength !== "none") {
  throw new Error("novel low-similarity input must be State A");
}
const novelBlob = [
  novel.snapshot.what_is_happening,
  novel.snapshot.what_matters_now,
  novel.snapshot.what_to_ask_next,
  ...novel.snapshot.follow_up_items,
].join(" ");
if (/\bpreviously\b|\blast time\b|\bon Jan\b|\bfull history\b/i.test(novelBlob)) {
  throw new Error("State A must not include history phrases");
}
if (!novel.guarantee.ok) {
  throw new Error(`State A guarantee failed: ${novel.guarantee.violations.join("; ")}`);
}
console.log("✓ State A — no history phrases");

// --- Strong match State C: wandering + blue towel ---
resetCaseMemoryStores();
const prior = processCaseMemoryLayer({
  input:
    "Dad was wandering at night again. Blue towel grounding worked and reduced agitation quickly.",
  now: "2026-04-15T02:58:00.000Z",
});
if (prior.policy.state === "C") {
  // First episode with intervention recorded mid-turn may still be A/B — intervention must be indexed.
}
if (prior.caseEntity.understanding.successfulInterventions.length === 0) {
  throw new Error("successful blue towel intervention must be recorded on Case");
}

const again = processCaseMemoryLayer({
  input: "Dad is wandering again tonight",
  now: "2026-07-14T02:45:00.000Z",
  preferredCaseId: prior.caseEntity.id,
});

if (again.policy.state !== "C") {
  throw new Error(
    `expected State C for strong wandering pattern, got ${again.policy.state} strength=${again.policy.matchStrength} reasons=${again.recall.triggerReasons.join(",")}`,
  );
}
if (again.policy.matchStrength !== "strong") {
  throw new Error("State C requires strong match");
}
const follow = again.snapshot.follow_up_items.join(" ");
if (!/blue towel|grounding|intervention|apply/i.test(follow)) {
  throw new Error("State C follow_up must emphasize prior successful intervention action");
}
if (listsMultiplePastDates(follow)) {
  throw new Error("State C must not list multiple past dates");
}
if (/2026-04-15.*2026-0[5-9]/i.test(follow) || (follow.match(/\b2026-\d{2}-\d{2}\b/g)?.length ?? 0) >= 2) {
  throw new Error("State C follow_up must not dump multiple timeline dates");
}
if (!/another nighttime wandering/i.test(again.snapshot.what_is_happening)) {
  throw new Error("State C what_is_happening should be minimal history (another episode)");
}
if (!/previously stabilized pattern|grounding object|reduced agitation/i.test(again.snapshot.what_matters_now)) {
  throw new Error("State C what_matters_now should carry intervention logic");
}
if (!again.guarantee.ok) {
  throw new Error(`State C guarantee failed: ${again.guarantee.violations.join("; ")}`);
}
console.log("✓ State C — intervention compression (blue towel), no multi-date dump");

// --- Exact schema for assembleDecisionSnapshot ---
const exact = assembleDecisionSnapshot({
  caseEntity: again.caseEntity,
  facts: extractFacts("Dad is wandering again tonight"),
  policy: again.policy,
  rawInput: "Dad is wandering again tonight",
});
if (!isExactDecisionSnapshotSchema(exact)) {
  throw new Error("assembleDecisionSnapshot must emit exact 6-key schema");
}
const keys = Object.keys(exact).sort();
const expected = [...CASE_DECISION_SNAPSHOT_KEYS].sort();
if (keys.join(",") !== expected.join(",")) {
  throw new Error(`snapshot keys mismatch: ${keys.join(",")} vs ${expected.join(",")}`);
}
const withExtra = { ...exact, timestamp: "nope" };
if (isExactDecisionSnapshotSchema(withExtra)) {
  throw new Error("extra fields must fail exact schema check");
}
console.log("✓ assembleDecisionSnapshot exact keys only");

const payload = toCaseMemoryLayerPayload(again);
if (!payload.decision_snapshot || payload.patternState !== "C") {
  throw new Error("layer payload must expose decision_snapshot and patternState");
}
console.log("✓ case_memory_layer payload");

// Pipeline wiring presence
const pipelineSource = fs.readFileSync(
  path.join(process.cwd(), "src/lib/analyze-pipeline/index.ts"),
  "utf-8",
);
if (!pipelineSource.includes("processCaseMemoryLayer")) {
  throw new Error("analyze-pipeline must call processCaseMemoryLayer");
}
if (!pipelineSource.includes("shapeSolenOSFromDecisionSnapshot")) {
  throw new Error("analyze-pipeline must shape SolenOS from Decision Snapshot");
}
if (!pipelineSource.includes("case_memory_layer")) {
  throw new Error("AnalyzePipelineRun must expose case_memory_layer");
}
console.log("✓ analyze-pipeline wiring");

const mapSource = fs.readFileSync(
  path.join(process.cwd(), "src/lib/solenos-layers/architecture-map.ts"),
  "utf-8",
);
if (!mapSource.includes("Case Memory + Pattern Response Policy")) {
  throw new Error("architecture-map must list Case Memory engine module");
}
console.log("✓ architecture-map updated");

const adrPath = path.join(
  process.cwd(),
  "docs/15-architecture-decisions/ADR-012-case-centered-memory-pattern-response-policy.md",
);
if (!fs.existsSync(adrPath)) {
  throw new Error("ADR-012 missing");
}
const prdPath = path.join(process.cwd(), "docs/02-product/prds/case-memory-prd.md");
if (!fs.existsSync(prdPath)) {
  throw new Error("Case Memory PRD missing");
}
console.log("✓ ADR-012 + Case Memory PRD present");

console.log("\n=== Case Memory: ALL CHECKS PASSED ===");
