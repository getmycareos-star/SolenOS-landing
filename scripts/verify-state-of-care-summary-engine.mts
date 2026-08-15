/**
 * verify-state-of-care-summary-engine.mts
 * State of Care — decision-ready compression of CareContext, always recomputed.
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
import { resetCareContextDiffStore } from "../src/lib/care-context-diff-engine";
import {
  STATE_OF_CARE_DEFINING_PRINCIPLE,
  STATE_OF_CARE_SECTIONS,
  STATE_OF_CARE_SUMMARY_IDENTITY,
  resetStateOfCareSummaryStore,
} from "../src/lib/state-of-care-summary-engine";
import { resetCareContextRootStore, processSituationInput } from "../src/lib/situation-entry";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== solenos State of Care Summary Engine ===\n");

resetStateOfCareSummaryStore();
resetCareContextDiffStore();
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

assert(STATE_OF_CARE_SUMMARY_IDENTITY.includes("decision-ready"), "state of care identity");
console.log("✓ structural contract");

const migration = path.join(root, "db/migrations/047_state_of_care_summary_engine.sql");
assert(fs.existsSync(migration), "migration 047");
console.log("✓ migration 047");

const first = await processSituationInput({
  raw_input: "Mobility baseline: walks independently.",
  caregiver_id: "cg_soc",
  timestamp: "2026-07-01T10:00:00.000Z",
});

assert(first.state_of_care_summary_layer !== undefined, "layer on SituationResponse");
assert(first.state_of_care_summary_layer.active === true, "state of care active");
assert(first.state_of_care_summary_layer.summary.snapshot_version === 1, "snapshot version increments");
console.log("✓ mandatory recompute on CareContext update");

for (const section of STATE_OF_CARE_SECTIONS) {
  assert(
    first.state_of_care_summary_layer.summary.sections[section].length >= 1,
    `section ${section} populated`,
  );
}
assert(first.state_of_care_summary_layer.summary.what_matters_most.length > 0, "prioritization mandatory");
console.log("✓ six-question structure");

const second = await processSituationInput({
  raw_input: "Repeated agitation and confusion observed today.",
  caregiver_id: "cg_soc",
  timestamp: "2026-07-02T10:00:00.000Z",
});

assert(second.state_of_care_summary_layer.summary.snapshot_version === 2, "regenerated after update");
assert(
  second.state_of_care_summary_layer.summary.sections.what_changed_recently.some(
    (l) => l !== "No significant changes since last update",
  ),
  "reflects change not repetition",
);
console.log("✓ always recomputed derived object");

const summaryText = JSON.stringify(second.state_of_care_summary_layer.summary);
assert(!/\"caregiver_id\"\s*:\s*\"cg_soc\"/.test(summaryText), "no raw caregiver_id in summary");
console.log("✓ no raw attribution");

const apiRoute = path.join(root, "src/app/api/situation/state-of-care-summary/route.ts");
const panel = path.join(root, "src/components/ops-devtools/StateOfCareSummaryPanel.tsx");
assert(fs.existsSync(apiRoute) || fs.existsSync(path.join(root, "../_solenos_backend_cleanup/src/app/api/situation/state-of-care-summary/route.ts")), "state-of-care-summary API route");
assert(fs.existsSync(panel), "StateOfCareSummaryPanel");
console.log("✓ API route");

const pillarPath = path.join(root, "src/lib/care-continuity-system/contract-constants.ts");
assert(fs.readFileSync(pillarPath, "utf-8").includes("state_of_care_summary_engine"), "pillar #27");
console.log("✓ care continuity pillar registered");

assert(
  second.state_of_care_summary_layer.defining_principle === STATE_OF_CARE_DEFINING_PRINCIPLE,
  "defining principle",
);

console.log("\n=== All state of care summary engine checks passed ===\n");
