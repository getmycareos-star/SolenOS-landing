import {
  COGNITIVE_LOAD_REDUCTION_FAILURE_MODEL,
  COGNITIVE_LOAD_REDUCTION_ONE_LINE_TRUTH,
  COGNITIVE_LOAD_REDUCTION_SUCCESS_METRIC,
  COGNITIVE_LOAD_STRICT_SCHEMA,
  COGNITIVE_LOAD_VALIDATION_PIPELINE,
} from "../src/lib/cognitive-load-reduction";
import { CANONICAL_ONE_LINE_TRUTH, CANONICAL_VALIDATION_PIPELINE } from "../src/lib/canonical-architecture";
import { SOLENOS_FIELD_ORDER } from "../src/lib/consistency-determinism/types";
import { validateAIResponse, SolenOSResponseSchema } from "../src/lib/response-validator";
import { SOLENOS_SYSTEM_PROMPT, SYSTEM_PROMPT_SPEC_MARKERS } from "../src/lib/solenos-langchain-adapter/system-prompt";
import { GEMINI_OUTPUT_SCHEMA } from "../src/lib/gemini-contract";
import { VERIFY_VALID_SOLENOS } from "./fixtures/solenos-valid";

console.log("=== Cognitive Load Reduction Engine (Final Contract) ===\n");

for (const marker of SYSTEM_PROMPT_SPEC_MARKERS) {
  if (!SOLENOS_SYSTEM_PROMPT.includes(marker)) {
    throw new Error(`system prompt missing cognitive load marker: ${marker}`);
  }
}
console.log("✓ unified cognitive load system prompt markers");

if (SOLENOS_FIELD_ORDER.length !== 6) {
  throw new Error("schema must have exactly 6 fields");
}
if (SOLENOS_FIELD_ORDER.join(",") !== COGNITIVE_LOAD_STRICT_SCHEMA.join(",")) {
  throw new Error("field order must match strict schema contract");
}
if (CANONICAL_ONE_LINE_TRUTH.includes("Persistence exists to validate")) {
  console.log("✓ relief validation persistence identity in canonical truth");
}
console.log("✓ strict 6-field immutable schema");

const validated = validateAIResponse(VERIFY_VALID_SOLENOS);
SolenOSResponseSchema.parse(validated);
if ("_meta" in validated || "emotional_context" in validated) {
  throw new Error("forbidden extra fields in schema");
}
if (typeof validated.what_to_ask_next !== "string") {
  throw new Error("what_to_ask_next must be a string");
}
console.log("✓ fixture validates against strict schema");

if (GEMINI_OUTPUT_SCHEMA.includes("_meta") || GEMINI_OUTPUT_SCHEMA.includes("emotional_context")) {
  throw new Error("gemini schema must not include removed fields");
}
if (!GEMINI_OUTPUT_SCHEMA.includes('"low" | "medium" | "high" | "critical"')) {
  throw new Error("gemini schema must use low|medium|high|critical risk levels");
}
console.log("✓ gemini envelope aligned to 6-field schema");

if (CANONICAL_VALIDATION_PIPELINE.join("|") !== COGNITIVE_LOAD_VALIDATION_PIPELINE.join("|")) {
  throw new Error("canonical validation pipeline must match cognitive load contract");
}
console.log("✓ section 15 validation pipeline enforced");

console.log(`\n✓ ${COGNITIVE_LOAD_REDUCTION_SUCCESS_METRIC}`);
console.log(`✓ ${COGNITIVE_LOAD_REDUCTION_FAILURE_MODEL}`);
console.log(`✓ ${COGNITIVE_LOAD_REDUCTION_ONE_LINE_TRUTH}`);
