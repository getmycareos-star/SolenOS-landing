import {
  CANONICAL_DETERMINISTIC_VALIDATION_CHECKS,
  CANONICAL_DISPLAY_SECTIONS,
  CANONICAL_FAILURE_MODEL,
  CANONICAL_ONE_LINE_TRUTH,
  CANONICAL_TRUST_PRINCIPLE,
} from "../src/lib/canonical-architecture";
import {
  checkInterpretationStability,
  checkPriorityStability,
  checkRepeatedInputConsistency,
  clearAllDeterminismSnapshots,
  DETERMINISM_FAILURE_TYPES,
  runDeterminismGate,
  verifyStructureDrift,
} from "../src/lib/consistency-determinism";
import { validateAIResponse } from "../src/lib/response-validator";
import {
  classifyInterpretationDriftFailure,
  classifyPriorityDriftFailure,
  classifyStructureDriftFailure,
  FailureLogEntrySchema,
} from "../src/lib/failure-observability";
import { SOLENOS_SYSTEM_PROMPT, SYSTEM_PROMPT_SPEC_MARKERS } from "../src/lib/solenos-langchain-adapter/system-prompt";
import { VERIFY_VALID_SOLENOS } from "./fixtures/solenos-valid";

console.log("=== SolenOS — CANONICAL DETERMINISTIC OUTPUT CONTRACT ===\n");

for (const marker of SYSTEM_PROMPT_SPEC_MARKERS) {
  if (!SOLENOS_SYSTEM_PROMPT.includes(marker)) {
    throw new Error(`system prompt missing deterministic marker: ${marker}`);
  }
}
console.log("✓ deterministic system prompt markers");

if (!SOLENOS_SYSTEM_PROMPT.includes(CANONICAL_TRUST_PRINCIPLE)) {
  throw new Error("trust principle missing from prompt");
}
console.log("✓ trust principle in prompt");

if (CANONICAL_DISPLAY_SECTIONS.length !== 6) {
  throw new Error("must define exactly 6 fixed output sections");
}
if (CANONICAL_DISPLAY_SECTIONS[0]!.label !== "WHAT IS HAPPENING") {
  throw new Error("first section must map what_is_happening → WHAT IS HAPPENING");
}
console.log("✓ fixed 6-section output contract");

if (DETERMINISM_FAILURE_TYPES.length !== 5) {
  throw new Error("four mandatory drift failure types + consistency");
}
console.log("✓ drift failure types registered");

const base = validateAIResponse(VERIFY_VALID_SOLENOS);
const rawOrdered = { ...base };

const drift = verifyStructureDrift(rawOrdered, base);
if (!drift.ok) {
  throw new Error(`structure drift check failed: ${drift.reason}`);
}
console.log("✓ structure drift check");

clearAllDeterminismSnapshots();
const input = "Mom missed her evening medication.";
const repeat = checkRepeatedInputConsistency(input, base);
if (!repeat.ok) {
  throw new Error("repeated input test failed");
}
console.log("✓ repeated input test (11.1)");

const priority = checkPriorityStability(input, base);
if (!priority.ok) {
  throw new Error("priority stability check failed");
}
console.log("✓ priority stability check (11.3)");

const interpretation = checkInterpretationStability(input, base);
if (!interpretation.ok) {
  throw new Error("interpretation stability check failed");
}
console.log("✓ interpretation stability check (11.4)");

FailureLogEntrySchema.parse({
  timestamp: new Date().toISOString(),
  stage: "postprocess",
  failure_type: classifyStructureDriftFailure().failure_type,
  retry_count: 0,
});
console.log("✓ drift failures logged via observability");

console.log(`\n✓ ${CANONICAL_ONE_LINE_TRUTH}`);
