/**
 * verify-continuous-execution-loop.mts
 * Continuous execution loop — unified input, diff engine, uncertainty state machine.
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
import {
  CONTINUOUS_EXECUTION_IDENTITY,
  EXECUTION_LOOP_PHASES,
  STATE_UPDATE_OPERATIONS,
  UNCERTAINTY_STATES,
  computeStateDiff,
  diffHasOutputTrigger,
  diffToSummaryLines,
  processContinuousExecutionLoop,
  reprocessContinuousExecutionLoop,
  resetContinuousExecutionStore,
  resolveSystemMode,
} from "../src/lib/continuous-execution-loop";
import {
  resetCareContextRootStore,
  processSituationInput,
  processSituationRecompile,
} from "../src/lib/situation-entry";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== SolenOS Continuous Execution Loop ===\n");

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

assert(CONTINUOUS_EXECUTION_IDENTITY.includes("INPUT"), "loop identity");
assert(EXECUTION_LOOP_PHASES.length === 7, "seven loop phases");
assert(STATE_UPDATE_OPERATIONS.length === 3, "add/correct/link");
assert(UNCERTAINTY_STATES.length === 4, "four uncertainty states");
console.log("✓ system contract");

const migration = path.join(root, "db/migrations/037_continuous_execution_loop.sql");
assert(fs.existsSync(migration), "migration 037 exists");
console.log("✓ migration 037");

assert(resolveSystemMode(true, 1) === "bootstrap", "bootstrap mode");
assert(resolveSystemMode(false, 2) === "continuous", "continuous mode");
console.log("✓ system mode transition");

const first = await processSituationInput({
  raw_input: "Mom fell yesterday and hasn't been eating properly",
  caregiver_id: "cg_loop",
  timestamp: "2026-07-01T10:00:00.000Z",
});

assert(first.continuous_execution_loop_layer !== undefined, "loop layer on response");
assert(first.continuous_execution_loop_layer.system_mode === "bootstrap", "bootstrap on first input");
assert(first.continuous_execution_loop_layer.raw_input_event.raw_text.length > 0, "raw_input_event");
assert(first.continuous_execution_loop_layer.output_triggered_by_diff === true, "diff triggers output");
console.log("✓ unified input → execution loop");

const second = await processSituationInput({
  raw_input: "She also missed her morning medication",
  caregiver_id: "cg_loop",
  timestamp: "2026-07-02T10:00:00.000Z",
});

assert(second.continuous_execution_loop_layer.system_mode === "continuous", "continuous after bootstrap");
assert(second.continuous_execution_loop_layer.operation === "add", "add operation");
assert(second.continuous_execution_loop_layer.diff.newly_added_events.length >= 1, "structured diff");
console.log("✓ continuous loop after first input");

const idle = await processSituationRecompile({
  caregiver_id: "cg_loop",
  trigger: "idle_refresh",
});

assert(idle !== null, "idle recompile");
assert(idle!.continuous_execution_loop_layer.loop_phase === "wait" || idle!.continuous_execution_loop_layer.idle_refresh !== null, "idle behavior");
console.log("✓ idle loop recompute");

const correction = await processSituationRecompile({
  caregiver_id: "cg_loop",
  trigger: "correction",
  correction_event_id: first.events_created[0]?.id ?? null,
});

assert(correction !== null, "correction recompile");
assert(correction!.continuous_execution_loop_layer.operation === "correct", "correction operation");
assert(correction!.final_output !== undefined, "output regenerated after correction");
console.log("✓ correction loop re-enters pipeline");

const diff = computeStateDiff(null, second.context, second.events_created, null);
assert(diffHasOutputTrigger(diff), "diff output trigger");
assert(diffToSummaryLines(diff, second.context.events).length >= 1, "diff summaries");
console.log("✓ diff engine");

const loopApi = path.join(root, "src/app/api/situation/loop/route.ts");
assert(fs.existsSync(loopApi), "loop API route");
console.log("✓ loop API route");

const panel = path.join(root, "src/components/ops-devtools/ContinuousExecutionPanel.tsx");
assert(fs.existsSync(panel), "ContinuousExecutionPanel");
console.log("✓ UI loop panel");

console.log("\n=== All continuous execution loop checks passed ===\n");
