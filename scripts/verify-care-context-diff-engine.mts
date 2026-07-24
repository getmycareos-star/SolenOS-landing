/**
 * verify-care-context-diff-engine.mts
 * Care Context Diff — interpreted change since last comprehension point.
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
import {
  CARE_CONTEXT_DIFF_DEFINING_PRINCIPLE,
  CARE_CONTEXT_DIFF_IDENTITY,
  CARE_CONTEXT_DIFF_SECTIONS,
  resetCareContextDiffStore,
} from "../src/lib/care-context-diff-engine";
import { resetCareContextRootStore, processSituationInput } from "../src/lib/situation-entry";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== solenos Care Context Diff Engine ===\n");

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

assert(CARE_CONTEXT_DIFF_IDENTITY.includes("human-understandable"), "care context diff identity");
console.log("✓ structural contract");

const migration = path.join(root, "db/migrations/048_care_context_diff_engine.sql");
assert(fs.existsSync(migration), "migration 048");
console.log("✓ migration 048");

await processSituationInput({
  raw_input: "Mobility baseline: walks independently.",
  caregiver_id: "cg_diff",
  timestamp: "2026-07-01T10:00:00.000Z",
});

const second = await processSituationInput({
  raw_input: "Near-fall reported while using walker in hallway.",
  caregiver_id: "cg_diff",
  timestamp: "2026-07-02T10:00:00.000Z",
});

assert(second.care_context_diff_layer !== undefined, "layer on SituationResponse");
assert(second.care_context_diff_layer.active === true, "diff active");
assert(second.care_context_diff_layer.has_meaningful_change === true, "meaningful change detected");
assert(second.care_context_diff_layer.diff.primary_change.length > 0, "primary change weighted");
console.log("✓ mandatory diff on CareContext update");

for (const section of CARE_CONTEXT_DIFF_SECTIONS) {
  assert(
    second.care_context_diff_layer.diff.sections[section].length >= 0,
    `section ${section} exists`,
  );
}
assert(
  second.care_context_diff_layer.diff.sections.system_interpretation.length >= 1,
  "system interpretation present",
);
assert(second.care_context_diff_layer.diff.time_frame.length > 0, "time-aware framing");
console.log("✓ six-section diff structure");

const diffText = JSON.stringify(second.care_context_diff_layer.diff);
assert(!diffText.includes("cg_diff"), "no caregiver attribution in diff");
console.log("✓ no attribution exposure");

const apiRoute = path.join(root, "src/app/api/situation/care-context-diff/route.ts");
const panel = path.join(root, "src/components/ops-devtools/CareContextDiffPanel.tsx");
assert(fs.existsSync(apiRoute), "care-context-diff API route");
assert(fs.existsSync(panel), "CareContextDiffPanel");
console.log("✓ API route");

const pillarPath = path.join(root, "src/lib/care-continuity-system/contract-constants.ts");
assert(fs.readFileSync(pillarPath, "utf-8").includes("care_context_diff_engine"), "pillar #28");
console.log("✓ care continuity pillar registered");

assert(
  second.care_context_diff_layer.defining_principle === CARE_CONTEXT_DIFF_DEFINING_PRINCIPLE,
  "defining principle",
);

console.log("\n=== All care context diff engine checks passed ===\n");
