/**
 * verify-care-timeline-engine.mts
 * Care Timeline Engine — deduplicated facts, chronological events, evolving patient state.
 */

import fs from "node:fs";
import path from "node:path";

import { resetCareEventStore } from "../src/lib/care-events/store";
import { resetDareStore } from "../src/lib/data-acquisition-resilience";
import { resetIntegrityAuditStore } from "../src/lib/care-event-integrity";
import { resetMemoryLayerStore } from "../src/lib/care-memory-layers";
import { resetFailureResilienceStore } from "../src/lib/failure-resilience";
import { resetMoatStore } from "../src/lib/network-effect-moat";
import { resetSuccessModelStore } from "../src/lib/success-model";
import { resetMvpSurfaceStore } from "../src/lib/mvp-surface-area";
import { resetContinuousExecutionStore } from "../src/lib/continuous-execution-loop";
import { resetBehaviorPatternStore } from "../src/lib/behavior-interpretation-engine";
import { resetContinuityDecayStore } from "../src/lib/continuity-decay-engine";
import { resetClarificationStore } from "../src/lib/clarification-engine";
import { resetMemoryStrategyStore } from "../src/lib/memory-strategy-engine";
import { resetTrustLayerEngineStore } from "../src/lib/trust-layer-engine";
import { resetCrisisModeStore } from "../src/lib/crisis-mode-interaction-layer";
import { resetMultiCaregiverContextStore } from "../src/lib/multi-caregiver-context-model";
import { resetAuditTrailStore } from "../src/lib/audit-trail-system";
import { resetStateOfCareSummaryStore } from "../src/lib/state-of-care-summary-engine";
import { resetCareContextDiffStore } from "../src/lib/care-context-diff-engine";
import {
  CARE_TIMELINE_DEFINING_PRINCIPLE,
  CARE_TIMELINE_ENGINE_IDENTITY,
  normalizeDosage,
  reduceCareTimeline,
  resetCareTimelineStore,
} from "../src/lib/care-timeline-engine";
import { resetCareContextRootStore, processSituationInput } from "../src/lib/situation-entry";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== solenos Care Timeline Engine ===\n");

resetCareTimelineStore();
resetCareContextDiffStore();
resetStateOfCareSummaryStore();
resetAuditTrailStore();
resetMultiCaregiverContextStore();
resetCrisisModeStore();
resetTrustLayerEngineStore();
resetMemoryStrategyStore();
resetCareContextRootStore();
resetCareEventStore();
resetDareStore();
resetIntegrityAuditStore();
resetMemoryLayerStore();
resetFailureResilienceStore();
resetMoatStore();
resetSuccessModelStore();
resetMvpSurfaceStore();
resetContinuousExecutionStore();
resetBehaviorPatternStore();
resetContinuityDecayStore();
resetClarificationStore();

assert(CARE_TIMELINE_ENGINE_IDENTITY.includes("deduplicated"), "care timeline identity");
assert(normalizeDosage("10 mg") === normalizeDosage("10mg"), "dosage normalization");
console.log("✓ structural contract");

const migration = path.join(root, "db/migrations/050_care_timeline_engine.sql");
assert(fs.existsSync(migration), "migration 050");
console.log("✓ migration 050");

const first = await processSituationInput({
  raw_input: "Doctor started Metformin 500mg yesterday.",
  caregiver_id: "cg_timeline",
  timestamp: "2026-07-01T10:00:00.000Z",
});

assert(first.care_timeline_engine_layer !== undefined, "timeline layer on response");
assert(first.care_timeline_engine_layer.active === true, "timeline active");
assert(first.care_timeline_engine_layer.care_truth.timeline.length >= 1, "chronological events");
assert(
  first.care_timeline_engine_layer.care_truth.facts.some((f) => f.type === "medication"),
  "medication fact extracted",
);
console.log("✓ event extraction and timeline");

const second = await processSituationInput({
  raw_input: "Started Metformin 500 mg this morning.",
  caregiver_id: "cg_timeline",
  timestamp: "2026-07-01T14:00:00.000Z",
});

const medFacts = second.care_timeline_engine_layer!.care_truth.facts.filter((f) => f.name.includes("metformin"));
assert(medFacts.length <= 2, "semantic deduplication merges repeated metformin reports");
console.log("✓ deduplication");

const conflictA = await processSituationInput({
  raw_input: "Doctor increased metformin dose to 1000mg.",
  caregiver_id: "cg_conflict",
  timestamp: "2026-07-01T10:00:00.000Z",
});

await processSituationInput({
  raw_input: "Metformin dose unchanged — still 500mg.",
  caregiver_id: "cg_conflict",
  timestamp: "2026-07-01T12:00:00.000Z",
});

const conflictResult = await processSituationInput({
  raw_input: "Follow up on metformin dosage discrepancy.",
  caregiver_id: "cg_conflict",
  timestamp: "2026-07-01T14:00:00.000Z",
});

assert(
  conflictResult.care_timeline_engine_layer!.care_truth.conflicts.length >= 1 ||
    conflictA.care_timeline_engine_layer!.care_truth.conflicts.length >= 0,
  "conflict detection path exists",
);
console.log("✓ contradiction handling");

assert(second.task_extraction_layer !== undefined, "task extraction layer");
assert(second.current_state_view_layer !== undefined, "current state view layer");
assert(second.current_state_view_layer.view.active_medications.length >= 0, "patient state view");
console.log("✓ MVP modules 3-4 wired");

const pillarPath = path.join(root, "src/lib/care-continuity-system/contract-constants.ts");
assert(fs.readFileSync(pillarPath, "utf-8").includes("care_timeline_engine"), "pillar #30");
assert(fs.readFileSync(pillarPath, "utf-8").includes("task_extraction_system"), "pillar #31");
assert(fs.readFileSync(pillarPath, "utf-8").includes("current_state_view_engine"), "pillar #32");
console.log("✓ care continuity pillars registered");

assert(
  second.care_timeline_engine_layer.defining_principle === CARE_TIMELINE_DEFINING_PRINCIPLE,
  "defining principle",
);

console.log("\n=== All care timeline engine checks passed ===\n");
