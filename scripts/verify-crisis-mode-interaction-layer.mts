/**
 * verify-crisis-mode-interaction-layer.mts
 * Crisis Mode — triage overlay when urgency exceeds threshold.
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
import {
  CRISIS_BEHAVIOR_RULES,
  CRISIS_MODE_DEFINING_PRINCIPLE,
  CRISIS_MODE_IDENTITY,
  MAX_LINES_PER_SECTION,
  processCrisisModeInteraction,
  resetCrisisModeStore,
} from "../src/lib/crisis-mode-interaction-layer";
import { applyCrisisOverlay } from "../src/lib/final-output-contract/crisis-overlay";
import { compileFromSituationResponse } from "../src/lib/final-output-contract";
import { resetCareContextRootStore, processSituationInput } from "../src/lib/situation-entry";
import { resetPolicyEngineStore, seedVerifyConsent } from "../src/lib/policy-engine";
import { isRetrospectiveCareReport } from "../src/lib/mvp-input-architecture";
import { isAcuteCrisisFall } from "../src/lib/crisis-mode-interaction-layer";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== solenos Crisis Mode Interaction Layer ===\n");

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
resetPolicyEngineStore();
seedVerifyConsent("cg_crisis");
seedVerifyConsent("cg_crisis_critical");
seedVerifyConsent("cg_crisis_fp");

assert(CRISIS_MODE_IDENTITY.includes("crisis moments"), "crisis mode identity");
assert(CRISIS_BEHAVIOR_RULES.length === 8, "eight behavior rules");
console.log("✓ crisis mode contract");

const migration = path.join(root, "db/migrations/044_crisis_mode_interaction_layer.sql");
assert(fs.existsSync(migration), "migration 044");
console.log("✓ migration 044");

const calm = await processSituationInput({
  raw_input: "Routine check-in — medication taken as scheduled.",
  caregiver_id: "cg_crisis",
  timestamp: "2026-07-01T10:00:00.000Z",
});

assert(calm.crisis_mode_interaction_layer !== undefined, "layer on SituationResponse");
assert(calm.crisis_mode_interaction_layer.crisis_mode === false, "calm input — no crisis mode");
assert(calm.crisis_mode_interaction_layer.ui_mode === "full", "full UI when calm");
console.log("✓ calm mode — full reasoning allowed");

const crisis = await processSituationInput({
  raw_input: "Mom fell and hit her head. I don't know what to do. Help!",
  caregiver_id: "cg_crisis",
  timestamp: "2026-07-01T10:05:00.000Z",
});

assert(crisis.crisis_mode_interaction_layer.crisis_mode === true, "crisis mode activated");
assert(
  crisis.crisis_mode_interaction_layer.crisis_output !== null,
  "strict crisis output schema",
);
assert(
  crisis.crisis_mode_interaction_layer.crisis_output!.immediate_concerns.length <= 3,
  "max 3 immediate concerns",
);
assert(
  crisis.crisis_mode_interaction_layer.crisis_output!.immediate_actions.length <= MAX_LINES_PER_SECTION,
  "max lines per section",
);
assert(
  crisis.crisis_mode_interaction_layer.suppressed_engines.length >= 1,
  "non-essential engines suppressed",
);
assert(
  ["checklist", "single_action", "condensed"].includes(crisis.crisis_mode_interaction_layer.ui_mode),
  "condensed UI in crisis",
);
console.log("✓ crisis triggers and compressed output");

assert(
  crisis.final_output.confidence_state.reasoning_limits.some((l) => l.includes("Crisis mode")),
  "final output crisis overlay",
);
assert(crisis.final_output.risk_level === "high", "elevated risk in crisis");
console.log("✓ final output integration");

const critical = await processSituationInput({
  raw_input: "She is not breathing. Help emergency now!",
  caregiver_id: "cg_crisis_critical",
  timestamp: "2026-07-02T10:00:00.000Z",
});

assert(critical.crisis_mode_interaction_layer.urgency_level === "critical", "critical urgency");
assert(critical.crisis_mode_interaction_layer.ui_mode === "single_action", "single-screen action mode");
console.log("✓ critical urgency level");

const apiRoute = path.join(root, "src/app/api/situation/crisis-mode/route.ts");
const panel = path.join(root, "src/components/ops-devtools/CrisisModeInteractionPanel.tsx");
assert(fs.existsSync(apiRoute), "crisis-mode API route");
assert(fs.existsSync(panel), "CrisisModeInteractionPanel");
console.log("✓ API and UI");

const pillarPath = path.join(root, "src/lib/care-continuity-system/contract-constants.ts");
assert(
  fs.readFileSync(pillarPath, "utf-8").includes("crisis_mode_interaction_layer"),
  "pillar #24 crisis_mode_interaction_layer",
);
console.log("✓ care continuity pillar registered");

assert(
  crisis.crisis_mode_interaction_layer.defining_principle === CRISIS_MODE_DEFINING_PRINCIPLE,
  "defining principle",
);

const compiled = compileFromSituationResponse(crisis);
const overlaid = applyCrisisOverlay(compiled, crisis.crisis_mode_interaction_layer);
assert(overlaid.what_matters_now.includes("safety") || overlaid.what_matters_now.length > 10, "action-first output");
console.log("✓ action over understanding");

// ─── False positives: ordinary continuity must not enter crisis mode ───────
assert(
  isRetrospectiveCareReport("Mom fell yesterday. We went to urgent care."),
  "yesterday + urgent care is retrospective",
);
assert(
  !isAcuteCrisisFall("Mom fell yesterday. We went to urgent care."),
  "past fall + care sought is not acute crisis fall",
);
assert(isAcuteCrisisFall("Mom fell and hit her head. Help!"), "fall + head injury is acute");
assert(!isAcuteCrisisFall("Dad had a fall last week."), "past fall alone is not acute");

const pastFall = await processSituationInput({
  raw_input: "Mom fell yesterday. We went to urgent care.",
  caregiver_id: "cg_crisis_fp",
  timestamp: "2026-07-03T10:00:00.000Z",
});
assert(pastFall.events_created.length >= 1, "past fall still enters the record");
assert(
  pastFall.crisis_mode_interaction_layer.crisis_mode === false,
  "FP: past fall + urgent care already sought — no crisis mode",
);
assert(pastFall.crisis_mode_interaction_layer.ui_mode === "full", "FP: full calm UI");
assert(
  pastFall.crisis_mode_interaction_layer.active === false,
  "FP: crisis layer inactive for continuity capture",
);
assert(
  pastFall.crisis_mode_interaction_layer.trigger_reasons.length === 0,
  "FP: no crisis trigger reasons on retrospective fall",
);
console.log("✓ FP: past fall + urgent care already sought");

const bareFall = await processSituationInput({
  raw_input: "She had a fall last week at home.",
  caregiver_id: "cg_crisis_fp",
  timestamp: "2026-07-03T11:00:00.000Z",
});
assert(bareFall.crisis_mode_interaction_layer.crisis_mode === false, "FP: bare past fall — no crisis");
console.log("✓ FP: bare past fall");

const helpOrganize = await processSituationInput({
  raw_input: "I need help organizing her medication list for the appointment.",
  caregiver_id: "cg_crisis_fp",
  timestamp: "2026-07-03T12:00:00.000Z",
});
assert(
  helpOrganize.crisis_mode_interaction_layer.crisis_mode === false,
  "FP: 'need help' without acute danger — no crisis",
);
console.log("✓ FP: soft help-seeking without acute context");

const urgentAppt = await processSituationInput({
  raw_input: "This is urgent for tomorrow's appointment paperwork.",
  caregiver_id: "cg_crisis_fp",
  timestamp: "2026-07-03T13:00:00.000Z",
});
assert(
  urgentAppt.crisis_mode_interaction_layer.crisis_mode === false,
  "FP: 'urgent' for paperwork — no crisis",
);
console.log("✓ FP: urgent without acute medical danger");

console.log("\n=== All crisis mode interaction layer checks passed ===\n");
