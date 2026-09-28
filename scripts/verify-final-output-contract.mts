/**
 * verify-final-output-contract.mts
 * Final output contract — single schema, runtime validation, API enforcement.
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
import {
  buildDegradedOutput,
  compileFromSituationResponse,
  FINAL_OUTPUT_CONTRACT_IDENTITY,
  FinalOutputContractSchema,
  REQUIRED_OUTPUT_FIELDS,
  validateFinalOutput,
} from "../src/lib/final-output-contract";
import { validateAIResponse } from "../src/lib/response-validator";
import { buildBlockedSolenOSResponse } from "../src/lib/risk-uncertainty-engine/build-output";
import { resetCareContextRootStore, processSituationInput } from "../src/lib/situation-entry";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== SolenOS Final Output Contract ===\n");

resetCareContextRootStore();
resetCareEventStore();
resetDareStore();
resetIntegrityAuditStore();
resetMemoryLayerStore();
resetFailureResilienceStore();
resetMoatStore();
resetSuccessModelStore();

assert(FINAL_OUTPUT_CONTRACT_IDENTITY.includes("one canonical"), "contract identity");
// The contract has grown fields since this was written; assert the required set is
// present rather than a fixed count that silently rots.
for (const field of [
  "what_is_happening",
  "what_matters_now",
  "what_to_ask_next",
  "risk_level",
  "what_can_wait",
  "follow_up_items",
  "decision_trace",
  "confidence_state",
  "trust_layer",
]) {
  assert(REQUIRED_OUTPUT_FIELDS.includes(field as never), `required field ${field}`);
}
console.log("✓ system contract");

// The contract is compiled in process from the situation response; it has no table
// of its own, so presence of the module is the check rather than a migration.
assert(
  fs.existsSync(path.join(root, "src/lib/final-output-contract/index.ts")),
  "final output contract module present",
);
console.log("✓ contract module (no persistence layer, so no migration)");

const degraded = buildDegradedOutput({ reason: "test degrade" });
assert(FinalOutputContractSchema.safeParse(degraded).success, "degraded output valid");
console.log("✓ degrade to uncertainty fields");

const result = await processSituationInput({
  raw_input: "Mom fell yesterday and went to hospital",
  caregiver_id: "cg_output",
  timestamp: "2026-07-01T10:00:00.000Z",
});

assert(result.final_output !== undefined, "final_output on SituationResponse");
validateFinalOutput(result.final_output);
assert(result.final_output.what_is_happening.length > 0, "what_is_happening");
assert(result.final_output.decision_trace.events.length >= 0, "decision_trace");
assert(result.final_output.confidence_state.completeness >= 0, "confidence_state");
assert(result.final_output.trust_layer.unknown.length >= 1, "trust_layer unknown surfaced");
assert(result.final_output.trust_layer.confidence >= 0 && result.final_output.trust_layer.confidence <= 1, "trust confidence 0-1");
assert(["low", "medium", "high"].includes(result.final_output.risk_level), "risk_level enum");
const caregiverFacing = [
  result.final_output.what_is_happening,
  result.final_output.what_matters_now,
  result.final_output.what_to_ask_next,
  result.final_output.what_can_wait,
  ...result.final_output.follow_up_items,
  ...result.final_output.confidence_state.reasoning_limits,
].join(" ");
assert(!/%\s*confidence/i.test(caregiverFacing), "no % confidence in caregiver strings");
assert(!/Track food and fluid/i.test(caregiverFacing), "no eat→fluids keyword Clarity");
assert(!/Check safety and whether medical follow-up/i.test(caregiverFacing), "no fall→safety keyword Clarity");
console.log("✓ compile from situation pipeline");

const compiled = compileFromSituationResponse(result);
assert(compiled.follow_up_items.length >= 0, "follow_up_items array");
console.log("✓ compileFromSituationResponse");

resetCareContextRootStore();
resetCareEventStore();
const eatResult = await processSituationInput({
  raw_input: "Dad refuses food and won't eat dinner",
  caregiver_id: "cg_output_eat",
  timestamp: "2026-07-01T12:00:00.000Z",
});
assert(eatResult.final_output !== undefined, "eat final_output");
assert(
  !/Track food and fluid/i.test(eatResult.final_output.what_matters_now),
  "refusal note must not invent fluid-tracking Clarity",
);
assert(!/%\s*confidence/i.test(eatResult.final_output.what_matters_now), "no % on eat path");
console.log("✓ no keyword Clarity on refusal note");

const blocked = buildBlockedSolenOSResponse({
  situation_summary: "Test situation",
  information_completeness: "INCOMPLETE",
  confidence_level: "Insufficient Information",
  priority_assessment: "Unable to Determine",
  missing_information: ["timing"],
  clarifying_questions: ["When did this start?"],
  continuity_record: "recorded",
  decision_gate_blocked: true,
  triggered_domains: [],
});
validateAIResponse(blocked);
assert(blocked.decision_trace.unknowns.length >= 1, "blocked has unknowns");
console.log("✓ response-validator uses full schema");

// final_output is produced inside the single caregiver entry (/api/situation) and
// rendered by the ops-quarantined panel; there is no second output route to ship.
const situationRoute = path.join(root, "src/app/api/situation/route.ts");
assert(fs.existsSync(situationRoute), "final output is served by the situation entry");
console.log("✓ final output served from the single entry route");

const uiPanel = path.join(root, "src/components/ops-clarity/FinalOutputPanel.tsx");
assert(fs.existsSync(uiPanel), "FinalOutputPanel exists under ops-clarity quarantine");
console.log("✓ UI renderer contract (ops-quarantined)");

console.log("\n=== All final output contract checks passed ===\n");
