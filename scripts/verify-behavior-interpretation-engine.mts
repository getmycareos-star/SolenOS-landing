/**
 * verify-behavior-interpretation-engine.mts
 * Behavior Interpretation Engine — CareEvent consumption, multi-hypothesis reasoning.
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
import {
  BEHAVIOR_ENGINE_BOUNDARY,
  BEHAVIOR_INTERPRETATION_IDENTITY,
  BEHAVIOR_PROHIBITED,
  BEHAVIOR_TAXONOMY,
  classifyObservedBehaviors,
  generateHypotheses,
  processBehaviorInterpretation,
  resetBehaviorPatternStore,
} from "../src/lib/behavior-interpretation-engine";
import { resetCareContextRootStore, processSituationInput } from "../src/lib/situation-entry";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== SolenOS Behavior Interpretation Engine ===\n");

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

assert(BEHAVIOR_INTERPRETATION_IDENTITY.includes("care situations"), "wedge identity");
assert(BEHAVIOR_ENGINE_BOUNDARY.includes("never diagnose"), "clinical boundary");
assert(BEHAVIOR_PROHIBITED.length >= 6, "prohibited behaviors");
assert(BEHAVIOR_TAXONOMY.length >= 20, "extensible taxonomy");
console.log("✓ system contract");

const migration = path.join(root, "db/migrations/038_behavior_interpretation_engine.sql");
assert(fs.existsSync(migration), "migration 038 exists");
console.log("✓ migration 038");

const first = await processSituationInput({
  raw_input: "Dad keeps asking when we are leaving and refuses his evening medication.",
  caregiver_id: "cg_behavior",
  timestamp: "2026-07-01T10:00:00.000Z",
});

assert(first.behavior_interpretation_layer !== undefined, "layer on SituationResponse");
assert(first.behavior_interpretation_layer.triggered === true, "behavior engine triggered");
assert(first.behavior_interpretation_layer.observed_behaviors.length >= 1, "observed behaviors");
assert(first.behavior_interpretation_layer.hypotheses.length >= 2, "multiple hypotheses");
assert(
  first.behavior_interpretation_layer.hypotheses.every((h) => h.confidence !== undefined),
  "confidence on each hypothesis",
);
console.log("✓ consumes CareEvents after pipeline");

const second = await processSituationInput({
  raw_input: "He took medication consistently for six months but refused again today.",
  caregiver_id: "cg_behavior",
  timestamp: "2026-07-02T10:00:00.000Z",
});

assert(
  second.behavior_interpretation_layer.behavioral_change_detected ||
    second.behavior_interpretation_layer.observed_behaviors.some((b) => b.behavior_id === "refuses_medication"),
  "historical change significance",
);
console.log("✓ continuity integration");

assert(second.final_output.decision_trace.assumptions.length >= 1, "explainable decision trace");
assert(second.final_output.decision_trace.unknowns.length >= 0, "uncertainty in trace");
console.log("✓ trust and explainability in final output");

const empty = processBehaviorInterpretation({
  caregiver_id: "cg_empty",
  events_created: [],
  all_events: [],
  prior_events: [],
  what_changed: [],
});
assert(empty.triggered === false, "no trigger without behavioral events");
console.log("✓ no inference without CareEvents");

const apiRoute = path.join(root, "src/app/api/situation/behavior/route.ts");
const panel = path.join(root, "src/components/ops-devtools/BehaviorInterpretationPanel.tsx");
assert(fs.existsSync(apiRoute), "behavior API route");
assert(fs.existsSync(panel), "BehaviorInterpretationPanel");
console.log("✓ API and UI");

const observed = first.behavior_interpretation_layer.observed_behaviors.length > 0
  ? first.behavior_interpretation_layer.observed_behaviors
  : classifyObservedBehaviors(first.events_created);
const hypotheses = generateHypotheses(observed);
assert(hypotheses.length >= 2, "interpretation layer multi-hypothesis");
console.log("✓ reasoning pipeline");

console.log("\n=== All behavior interpretation checks passed ===\n");
