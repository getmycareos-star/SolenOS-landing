import fs from "node:fs";
import path from "node:path";
import {
  CANONICAL_DISPLAY_SECTIONS,
  CANONICAL_ONE_LINE_TRUTH,
  CANONICAL_PRODUCT_MOAT,
  CANONICAL_RISK_LEVELS,
  CANONICAL_SYSTEM_PURPOSE,
  CANONICAL_VALIDATION_PIPELINE,
} from "../src/lib/canonical-architecture";
import { verifyUnknownState, isUnknownStateValid } from "../src/lib/unknown-state-verification";
import { validateAIResponse } from "../src/lib/response-validator";
import {
  classifyUnknownStateFailure,
  FailureLogEntrySchema,
} from "../src/lib/failure-observability";
import { SOLENOS_SYSTEM_PROMPT, SYSTEM_PROMPT_SPEC_MARKERS } from "../src/lib/solenos-langchain-adapter/system-prompt";
import { VERIFY_VALID_SOLENOS } from "./fixtures/solenos-valid";

console.log("=== SolenOS — Implementation Enforcement Identity ===\n");

for (const marker of SYSTEM_PROMPT_SPEC_MARKERS) {
  if (!SOLENOS_SYSTEM_PROMPT.includes(marker)) {
    throw new Error(`system prompt missing identity marker: ${marker}`);
  }
}
console.log("✓ system identity prompt markers");

if (!SOLENOS_SYSTEM_PROMPT.includes("Living Care Record")) {
  throw new Error("system prompt missing Living Care Record product identity");
}
if (!SOLENOS_SYSTEM_PROMPT.includes("deterministic cognitive compression engine")) {
  throw new Error("system prompt missing compression path identity");
}
if (!SOLENOS_SYSTEM_PROMPT.includes("CRITICAL")) {
  throw new Error("system prompt must define CRITICAL risk tier");
}
console.log("✓ product identity + compression path + CRITICAL risk");

if (CANONICAL_RISK_LEVELS.length !== 4 || !CANONICAL_RISK_LEVELS.includes("critical")) {
  throw new Error("canonical risk levels must include critical");
}
console.log(`✓ canonical moat: ${CANONICAL_PRODUCT_MOAT}`);

for (const forbidden of ["chatbot", "AI assistant", "workflow platform", "personalization engine"]) {
  if (!SOLENOS_SYSTEM_PROMPT.toLowerCase().includes(forbidden.toLowerCase())) {
    throw new Error(`prompt must list forbidden identity: ${forbidden}`);
  }
}
console.log("✓ forbidden identities");

if (CANONICAL_DISPLAY_SECTIONS.length !== 6) {
  throw new Error("fixed output model must have 6 sections");
}
console.log("✓ 6-section fixed output");

if (CANONICAL_VALIDATION_PIPELINE[0] !== "JSON schema validation") {
  throw new Error("validation pipeline must start with schema validation");
}
console.log("✓ mandatory validation pipeline order");

const grounded = validateAIResponse(VERIFY_VALID_SOLENOS);
if (!isUnknownStateValid(grounded)) {
  throw new Error(`valid fixture must pass unknown-state: ${verifyUnknownState(grounded).violations.join(",")}`);
}
console.log("✓ unknown-state verification accepts valid fixture");

FailureLogEntrySchema.parse({
  timestamp: new Date().toISOString(),
  stage: "postprocess",
  failure_type: classifyUnknownStateFailure().failure_type,
  retry_count: 0,
});
console.log("✓ UNKNOWN_STATE_FAILURE logged via observability");

console.log(`\n✓ ${CANONICAL_SYSTEM_PURPOSE}`);
console.log(`✓ ${CANONICAL_ONE_LINE_TRUTH}`);
