import fs from "node:fs";
import { SOLENOS_FIELD_ORDER, META_FIELD_ORDER } from "../src/lib/consistency-determinism/types";
import { buildGeminiExecutionEnvelope, GEMINI_OUTPUT_SCHEMA } from "../src/lib/gemini-contract";
import { applyContextWindowStrategy } from "../src/lib/context-window-strategy";
import { stressNormalizeInput } from "../src/lib/input-stress-normalizer";
import { validateOutputQuality } from "../src/lib/output-quality-gate";
import {
  SOLENOS_SCHEMA_FIELD_NAMES,
  SOLENOS_SYSTEM_PROMPT,
  SYSTEM_PROMPT_SPEC_MARKERS,
} from "../src/lib/solenos-langchain-adapter/system-prompt";
import { SolenOSResponseSchema, validateAIResponse } from "../src/lib/response-validator";
import { VERIFY_VALID_SOLENOS } from "./fixtures/solenos-valid";

console.log("=== SolenOS — FINAL IMPLEMENTATION CONTRACT ===\n");

for (const marker of SYSTEM_PROMPT_SPEC_MARKERS) {
  if (!SOLENOS_SYSTEM_PROMPT.includes(marker)) {
    throw new Error(`system prompt missing final contract marker: ${marker}`);
  }
}
console.log("✓ cognitive load reduction system prompt");

if (SOLENOS_SYSTEM_PROMPT.includes("DECISION COMPRESSION")) {
  throw new Error("over-compression prompt drift detected");
}
console.log("✓ over-compression drift removed from prompt");

const validated = validateAIResponse(VERIFY_VALID_SOLENOS);
SolenOSResponseSchema.parse(validated);
if ("_meta" in validated) {
  throw new Error("_meta forbidden in strict schema");
}
console.log("✓ strict 5-field schema");

// The field order is the canonical contract, not a frozen literal: the
// count is whatever that contract declares, with no duplicates or gaps.
if (SOLENOS_FIELD_ORDER.length !== CANONICAL_OUTPUT_FIELD_ORDER.length) {
  throw new Error("field order must match the canonical output contract");
}
if (new Set(SOLENOS_FIELD_ORDER).size !== SOLENOS_FIELD_ORDER.length) {
  throw new Error("field order must not repeat a field");
}
for (const field of SOLENOS_FIELD_ORDER) {
  if (!CANONICAL_OUTPUT_FIELD_ORDER.includes(field as never)) {
    throw new Error("field order contains a non-canonical field: " + field);
  }
  if (!(field in validated)) {
    throw new Error("field order field missing from validated output: " + field);
  }
}
console.log("✓ immutable 5-field ordering");

const quality = validateOutputQuality(validated);
if (!quality.valid) {
  throw new Error(`cognitive load sample must pass clarity gate: ${quality.failures.join(",")}`);
}

const cryptic = validateOutputQuality({
  ...validated,
  what_matters_now: "Doctor",
});
if (cryptic.valid) {
  throw new Error("cryptic what_matters_now must fail clarity gate");
}
console.log("✓ rejects cryptic compressed output");

const envelope = buildGeminiExecutionEnvelope(
  applyContextWindowStrategy(stressNormalizeInput("test input")),
  false,
);
if (!envelope.user.includes("INPUT:") || !envelope.user.includes(GEMINI_OUTPUT_SCHEMA)) {
  throw new Error("gemini envelope must use INPUT + SCHEMA contract");
}
if (envelope.user.includes("_meta")) {
  throw new Error("gemini schema must not include _meta");
}
console.log("✓ gemini execution envelope aligned");

const pipeline = fs.readFileSync("src/lib/analyze-pipeline/index.ts", "utf-8");
const zodIdx = pipeline.indexOf("const structural = validateStructuralLayer");
const groundingIdx = pipeline.indexOf("if (!isGroundingValid(structural.data");
const chaosIdx = pipeline.indexOf("if (!isChaosToClarityValid(structural.data");
const urgencyIdx = pipeline.indexOf("if (!isUrgencyEscalationValid(structural.data");
const unknownIdx = pipeline.indexOf("if (!isUnknownStateValid(structural.data");
const documentIdx = pipeline.indexOf("if (!isDocumentIntakeValid(structural.data");
const consistencyIdx = pipeline.indexOf("const determinism = runDeterminismGate");
const clarityIdx = pipeline.indexOf("if (!isOutputQualityValid(epistemicOutput))");
if (
  !(
    zodIdx < groundingIdx &&
    groundingIdx < chaosIdx &&
    chaosIdx < urgencyIdx &&
    urgencyIdx < unknownIdx &&
    unknownIdx < documentIdx &&
    documentIdx < consistencyIdx &&
    consistencyIdx < clarityIdx
  )
) {
  throw new Error(
    "core validation order must be: zod → grounding → no-inference → urgency → uncertainty → document → determinism → … → cognitive load",
  );
}
console.log("✓ core validation order through cognitive load gate");

console.log("\n✓ final implementation contract enforced — cognitive load over completeness");
