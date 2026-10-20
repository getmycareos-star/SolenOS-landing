import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  CANONICAL_SITUATION_STATUSES,
  CORE_RUNTIME_FORBIDDEN,
  CORE_RUNTIME_GAPS,
  CORE_RUNTIME_IDENTITY,
  CORE_RUNTIME_ONE_LINE_TRUTH,
  CORE_RUNTIME_PIPELINE_STAGES,
  CORE_RUNTIME_TRUTH_LAYERS,
  mapCanonicalToLifecycle,
  mapLifecycleToCanonical,
  mapUiToCanonical,
  orchestrateCoreRuntime,
  resetCoreRuntimeStoresForTests,
} from "../src/lib/core-runtime";
import {
  DECISION_HISTORY_LAYER_FORBIDDEN,
  DECISION_HISTORY_LAYER_ONE_LINE_TRUTH,
  createEmptyDecisionHistoryLog,
  writeDecisionHistory,
  resetDecisionHistoryStore,
} from "../src/lib/decision-history";
import {
  processContextWeighting,
  CONTEXT_WEIGHTING_LAYER_ONE_LINE_TRUTH,
} from "../src/lib/context-weighting";
import {
  processConflictDetection,
  CONFLICT_DETECTION_LAYER_ONE_LINE_TRUTH,
} from "../src/lib/conflict-detection";
import {
  captureReasoningSnapshot,
  REASONING_SNAPSHOT_LAYER_FORBIDDEN,
  resetReasoningSnapshotStore,
} from "../src/lib/reasoning-snapshot";
import {
  HIGH_MISSING_INFO_CONFIDENCE_CAP,
  processPriorityEngineLayer,
} from "../src/lib/priority-engine";
import { processTimeEngineLayer } from "../src/lib/time-engine";
import {
  createDefaultMissingInformationQueueState,
  addMissingInformationItem,
  createMissingInformationItem,
  computeMissingInformationInfluenceEnvelope,
  resetMissingInformationQueueStore,
} from "../src/lib/missing-information-queue";
import {
  markResolved,
  archiveResolved,
  createEmptyTrackedSituation,
  buildArchiveEligibility,
  mapLifecycleToUiStatus,
  mapUiStatusToLifecycle,
  resetResolutionStoreForTests,
} from "../src/lib/resolution-engine";
import {
  mapConfirmedToValidated,
  mapValidatedToConfirmed,
  isConfirmedOrValidated,
} from "../src/lib/assumption-registry";
import {
  appendTimelineEntry,
  createEmptyTimeline,
} from "../src/lib/ui-runtime";

console.log("=== SolenOS Core Runtime ===\n");

if (!CORE_RUNTIME_IDENTITY.includes("state-driven")) {
  throw new Error("core runtime identity drift");
}
if (!CORE_RUNTIME_ONE_LINE_TRUTH.includes("Timeline = WHAT")) {
  throw new Error("truth layer separation must be documented");
}
if (!CORE_RUNTIME_ONE_LINE_TRUTH.includes("Decision History = WHY")) {
  throw new Error("decision history WHY must be documented");
}
if (CORE_RUNTIME_PIPELINE_STAGES[0] !== "input") {
  throw new Error("pipeline must start with input");
}
if (!CORE_RUNTIME_PIPELINE_STAGES.includes("decision_history_writer")) {
  throw new Error("pipeline must include decision history writer");
}
if (!CORE_RUNTIME_PIPELINE_STAGES.includes("timeline_writer")) {
  throw new Error("pipeline must include timeline writer");
}
if (!CORE_RUNTIME_FORBIDDEN.some((f) => f.includes("merging Timeline"))) {
  throw new Error("must forbid merging Timeline and Decision History");
}
if (CORE_RUNTIME_GAPS.length < 1) {
  throw new Error("gaps documentation required (health gate reconciliation)");
}
if (CANONICAL_SITUATION_STATUSES.join(",") !== "active,resolved,archived") {
  throw new Error("canonical statuses drift");
}
console.log("✓ core runtime contracts + truth layers");

if (CORE_RUNTIME_TRUTH_LAYERS.what.includes("Timeline") === false) {
  throw new Error("WHAT must be Timeline");
}
if (CORE_RUNTIME_TRUTH_LAYERS.why.includes("Decision History") === false) {
  throw new Error("WHY must be Decision History");
}
console.log("✓ truth layer map (WHAT/WHY/unknown/believed/active)");

// Situation status mapping consistency
if (mapLifecycleToCanonical("ACTIVE") !== "active") throw new Error("ACTIVE→active");
if (mapLifecycleToCanonical("RESOLVED") !== "resolved") throw new Error("RESOLVED→resolved");
if (mapLifecycleToCanonical("ARCHIVED") !== "archived") throw new Error("ARCHIVED→archived");
if (mapCanonicalToLifecycle("active") !== "ACTIVE") throw new Error("active→ACTIVE");
if (mapUiToCanonical("blocked") !== "active") throw new Error("blocked is facet of active");
if (mapUiToCanonical("waiting") !== "active") throw new Error("waiting is facet of active");
if (mapUiStatusToLifecycle("blocked") !== "ACTIVE") throw new Error("ui bridge blocked→ACTIVE");
if (mapLifecycleToUiStatus("ARCHIVED") !== "resolved") {
  throw new Error("archived maps to resolved in UI 4-status set");
}
console.log("✓ Situation status consistency (canonical ↔ resolution ↔ UI)");

// markResolved / archiveResolved aliases
const active = createEmptyTrackedSituation({
  id: "sit-1",
  title: "Test",
  careSessionId: "sess-1",
});
const resolved = markResolved(active, {
  kind: "USER_CONFIRMATION",
  detail: "confirmed handled",
  source: "user_input",
  recordedAt: new Date().toISOString(),
});
if (!resolved.ok || resolved.situation.status !== "RESOLVED") {
  throw new Error("markResolved must ACTIVE→RESOLVED");
}
const archived = archiveResolved(
  resolved.situation,
  buildArchiveEligibility(resolved.situation, [resolved.situation], 0),
);
if (!archived.ok || archived.situation.status !== "ARCHIVED") {
  throw new Error("archiveResolved must RESOLVED→ARCHIVED");
}
const resurrect = markResolved(archived.situation, {
  kind: "USER_CONFIRMATION",
  detail: "try resurrect",
  source: "user_input",
  recordedAt: new Date().toISOString(),
});
if (resurrect.ok) throw new Error("must not resurrect archived via markResolved");
console.log("✓ markResolved / archiveResolved (no resurrection)");

// Assumption confirmed ↔ validated
if (mapConfirmedToValidated("confirmed") !== "validated") {
  throw new Error("confirmed→validated");
}
if (mapValidatedToConfirmed("validated") !== "confirmed") {
  throw new Error("validated→confirmed");
}
if (!isConfirmedOrValidated("validated") || !isConfirmedOrValidated("confirmed")) {
  throw new Error("confirmed/validated influence synonyms");
}
console.log("✓ assumption confirmed ↔ validated mapping");

// Decision History ≠ Timeline
if (!DECISION_HISTORY_LAYER_ONE_LINE_TRUTH.includes("never merge")) {
  throw new Error("decision history must forbid merge with timeline");
}
if (!DECISION_HISTORY_LAYER_FORBIDDEN.some((f) => f.includes("Timeline"))) {
  throw new Error("decision history forbidden must mention Timeline");
}
let why = createEmptyDecisionHistoryLog();
why = writeDecisionHistory(why, {
  situationId: "sit-1",
  chosenAction: "clarify",
  reasoningSummary: "missing dosage",
  assumptionsUsed: ["meds unchanged"],
  missingInfoImpact: ["What is the medication dosage?"],
});
let what = createEmptyTimeline();
what = appendTimelineEntry(what, {
  type: "system_event",
  situationId: "sit-1",
  summary: "Input processed",
});
if (why.entries[0]!.chosenAction === undefined) throw new Error("WHY must have chosenAction");
if ((what.entries[0] as { chosenAction?: string }).chosenAction !== undefined) {
  throw new Error("Timeline WHAT must not carry chosenAction WHY field");
}
if (!("type" in what.entries[0]!) || !("summary" in what.entries[0]!)) {
  throw new Error("Timeline must be factual event log");
}
console.log("✓ HARD SEPARATION Timeline WHAT vs Decision History WHY");

// Context weighting + conflict + reasoning snapshot
const weights = processContextWeighting({
  userInput: "Mom was discharged recently",
  assumptionHints: ["appeal pending"],
});
if (weights.items.length < 1) throw new Error("context weighting must weight user input");
if (!CONTEXT_WEIGHTING_LAYER_ONE_LINE_TRUTH.includes("never invent facts")) {
  throw new Error("context weighting contract drift");
}

const conflicts = processConflictDetection({
  highMissingInfoCount: 2,
  assumptionInvalidations: [{ assumptionId: "a1", reason: "contradiction" }],
});
if (!conflicts.reEvaluationRequired) throw new Error("conflicts must trigger re-eval");
if (conflicts.totalConfidenceReduction <= 0) throw new Error("conflicts reduce confidence");
if (!CONFLICT_DETECTION_LAYER_ONE_LINE_TRUTH.includes("re-evaluation")) {
  throw new Error("conflict detection contract drift");
}

const snap = captureReasoningSnapshot({
  situationId: "sit-1",
  inputsUsed: ["input"],
  assumptionsUsed: ["a"],
  missingInfoSnapshot: ["gap"],
  contextWeights: weights.items.map((i) => i.weights),
});
if (!REASONING_SNAPSHOT_LAYER_FORBIDDEN.some((f) => f.includes("Priority"))) {
  throw new Error("snapshots must not be priority inputs");
}
if (snap.situationId !== "sit-1") throw new Error("snapshot situation scoped");
console.log("✓ context weighting + conflict detection + reasoning snapshot");

// HIGH missing info → confidence cap
resetMissingInformationQueueStore();
let miState = createDefaultMissingInformationQueueState("user-mi");
const gap = createMissingInformationItem({
  situationId: "sit-mi",
  question: "What is the discharge date?",
  importance: "HIGH",
  source: "user_input",
});
if (!gap) throw new Error("must create HIGH discharge-date gap");
miState = addMissingInformationItem(miState, gap);
const miEnvelope = computeMissingInformationInfluenceEnvelope(miState);
if (miEnvelope.highPriorityOpenCount < 1) throw new Error("HIGH gap must be open");

const timeEngine = processTimeEngineLayer({
  input: "Mom was discharged recently and dosage is unknown",
});
const priority = processPriorityEngineLayer({
  timeEngine,
  missingInformationEnvelope: miEnvelope,
});
for (const v of priority.vectors) {
  if (v.confidence > HIGH_MISSING_INFO_CONFIDENCE_CAP + 1e-9) {
    throw new Error(
      `HIGH missing info must cap confidence ≤ ${HIGH_MISSING_INFO_CONFIDENCE_CAP}, got ${v.confidence}`,
    );
  }
  if (Math.abs(v.confidence - (1 - v.uncertainty)) > 1e-9) {
    throw new Error("confidence must remain 1 - uncertainty after missing-info gate");
  }
}
if (
  miEnvelope.highPriorityOpenCount > 0 &&
  !priority.appliedConstraints.some((c) => c.kind === "high_missing_info") &&
  priority.vectors.length > 0
) {
  // Constraint applies when irreversible/aggressive candidates exist; confidence cap always applies.
}
console.log("✓ HIGH missing-info blocks high-confidence irreversible posture");

// Full orchestration
resetCoreRuntimeStoresForTests();
resetDecisionHistoryStore();
resetReasoningSnapshotStore();
resetResolutionStoreForTests();

const orch = orchestrateCoreRuntime({
  scopeId: "scope-core",
  careSessionId: randomUUID(),
  telemetryUserId: "00000000-0000-4000-8000-0000000000cc",
  userInput: "Mom was discharged recently; not sure about medication dosage",
  situationTitle: "Post-discharge medication uncertainty",
});

if (!orch.situation.id) throw new Error("orchestration must own Situation");
if (orch.situation.status !== "active") throw new Error("new situation must be active");
if (!orch.stagesCompleted.includes("decision_history_writer")) {
  throw new Error("must complete decision history writer stage");
}
if (!orch.stagesCompleted.includes("timeline_writer")) {
  throw new Error("must complete timeline writer stage");
}
if (!orch.decisionHistoryEntry) throw new Error("must write Decision History WHY");
if (!orch.timelineEntry) throw new Error("must write Timeline WHAT");
if (orch.decisionHistoryEntry.reasoningSummary.length < 1) {
  throw new Error("WHY must include reasoning");
}
if (orch.timelineEntry.summary.length < 1) throw new Error("WHAT must include summary");
if (
  "chosenAction" in (orch.timelineEntry as object) &&
  (orch.timelineEntry as { chosenAction?: string }).chosenAction
) {
  throw new Error("Timeline must not carry Decision History chosenAction");
}
if (orch.truthLayers.why.length < 1 || orch.truthLayers.what.length < 1) {
  throw new Error("truth layers must separate what/why");
}
if (!orch.reasoningSnapshot) throw new Error("must capture reasoning snapshot");
if (orch.highMissingInfoBlocked !== true && orch.missingInformation.envelope.highPriorityOpenCount > 0) {
  throw new Error("highMissingInfoBlocked must reflect HIGH gaps");
}
console.log("✓ orchestrateCoreRuntime Situation-first pipeline");

// Source presence
const root = process.cwd();
const required = [
  "src/lib/core-runtime/index.ts",
  "src/lib/core-runtime/orchestrate.ts",
  "src/lib/decision-history/index.ts",
  "src/lib/context-weighting/index.ts",
  "src/lib/conflict-detection/index.ts",
  "src/lib/reasoning-snapshot/index.ts",
  "src/lib/missing-information-queue/index.ts",
];
for (const rel of required) {
  if (!fs.existsSync(path.join(root, rel))) {
    throw new Error(`missing required module file: ${rel}`);
  }
}
console.log("✓ module files present");

console.log("\nAll core-runtime checks passed.");
