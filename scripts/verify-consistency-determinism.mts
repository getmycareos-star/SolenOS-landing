import {
  checkPromptRegressionWithGoldens,
  checkRepeatedInputConsistency,
  checkPriorityStability,
  checkInterpretationStability,
  clearAllDeterminismSnapshots,
  outputsAreIdentical,
  runDeterminismGate,
  verifyStructureDrift,
  VERIFY_PROMPT_REGRESSION_GOLDENS,
} from "../src/lib/consistency-determinism";
import { validateAIResponse } from "../src/lib/response-validator";
import {
  classifyConsistencyFailure,
  classifyDeterminismFailure,
  classifyStructureDriftFailure,
  FailureLogEntrySchema,
} from "../src/lib/failure-observability";
import { VERIFY_VALID_SOLENOS } from "./fixtures/solenos-valid";

console.log("=== Consistency & Determinism — DETERMINISTIC OUTPUT CONTRACT ===\n");

const base = VERIFY_VALID_SOLENOS;

const rawOrdered = {
  what_is_happening: base.what_is_happening,
  what_matters_now: base.what_matters_now,
  what_to_ask_next: base.what_to_ask_next,
  risk_level: base.risk_level,
  what_can_wait: base.what_can_wait,
  follow_up_items: base.follow_up_items,
  decision_trace: base.decision_trace,
  confidence_state: base.confidence_state,
  trust_layer: base.trust_layer,
  transparency_panel: base.transparency_panel,
};

const validated = validateAIResponse(rawOrdered);
const structure = verifyStructureDrift(rawOrdered, validated);
if (!structure.ok) {
  throw new Error("valid ordered output must pass structure drift gate");
}
console.log("✓ structure drift gate (schema + field ordering)");

const reordered = {
  risk_level: base.risk_level,
  what_is_happening: base.what_is_happening,
  what_matters_now: base.what_matters_now,
  what_to_ask_next: base.what_to_ask_next,
  what_can_wait: base.what_can_wait,
  follow_up_items: base.follow_up_items,
  decision_trace: base.decision_trace,
  confidence_state: base.confidence_state,
  trust_layer: base.trust_layer,
  transparency_panel: base.transparency_panel,
};
if (verifyStructureDrift(reordered, validated).ok) {
  throw new Error("wrong key order must fail structure drift check");
}
console.log("✓ immutable field ordering enforced");

clearAllDeterminismSnapshots();
const input = "Mom missed her evening medication.";
if (!checkRepeatedInputConsistency(input, base).ok) throw new Error("first run must pass");
if (!checkRepeatedInputConsistency(input, base).ok) throw new Error("repeat must pass");
if (checkRepeatedInputConsistency(input, { ...base, risk_level: "high" }).ok) {
  throw new Error("drift must fail");
}
console.log("✓ repeated input test (hard determinism)");

clearAllDeterminismSnapshots();
if (!checkPriorityStability(input, base).ok) throw new Error("priority first pass");
if (checkPriorityStability(input, { ...base, risk_level: "high" }).ok) {
  throw new Error("priority drift must fail");
}
console.log("✓ priority stability test");

clearAllDeterminismSnapshots();
if (!checkInterpretationStability(input, base).ok) throw new Error("interpretation first pass");
if (checkInterpretationStability(input, { ...base, risk_level: "high" }).ok) {
  throw new Error("interpretation drift must fail");
}
console.log("✓ interpretation stability test");

const goldenInput = "Mom missed her evening medication.";
if (!checkPromptRegressionWithGoldens(goldenInput, VERIFY_PROMPT_REGRESSION_GOLDENS[goldenInput]!, VERIFY_PROMPT_REGRESSION_GOLDENS).ok) {
  throw new Error("golden must match");
}
console.log("✓ prompt regression test (evolution safety)");

clearAllDeterminismSnapshots();
const gate = runDeterminismGate({ rawParsed: rawOrdered, validated, normalizedInput: input });
if (!gate.ok) throw new Error("determinism gate must pass");
console.log("✓ integrated determinism gate");

FailureLogEntrySchema.parse({
  timestamp: new Date().toISOString(),
  stage: "postprocess",
  failure_type: classifyConsistencyFailure().failure_type,
  retry_count: 0,
});
FailureLogEntrySchema.parse({
  timestamp: new Date().toISOString(),
  stage: "postprocess",
  failure_type: classifyStructureDriftFailure().failure_type,
  retry_count: 0,
});
FailureLogEntrySchema.parse({
  timestamp: new Date().toISOString(),
  stage: "postprocess",
  failure_type: classifyDeterminismFailure("PRIORITY_DRIFT_DETECTED").failure_type,
  retry_count: 0,
});
console.log("✓ determinism failures logged via observability");

if (!outputsAreIdentical(base, validated)) {
  throw new Error("canonical outputs must match");
}

console.log("\n✓ deterministic output contract enforced — zero runtime variability");
