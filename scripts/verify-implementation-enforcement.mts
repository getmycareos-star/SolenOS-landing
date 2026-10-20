import {
  COMPRESSION_LIMITS,
  IMPLEMENTATION_DATABASE_RECORD_FIELDS,
  IMPLEMENTATION_FINAL_PRODUCT_TRUTH,
  IMPLEMENTATION_GROUNDING_PRINCIPLE,
  IMPLEMENTATION_PRIORITY_STACK,
  IMPLEMENTATION_PRODUCT_MOAT,
  IMPLEMENTATION_SYSTEM_IDENTITY,
  IMPLEMENTATION_SYSTEM_PURPOSE,
  isOutputCompressionValid,
  validateOutputCompression,
} from "../src/lib/implementation-enforcement";
import { SOLENOS_RISK_LEVELS } from "../src/lib/implementation-enforcement/risk-levels";
import {
  assertReliefValidationRecordBoundary,
  RELIEF_VALIDATION_RECORD_FIELDS,
} from "../src/lib/relief-validation";
import { validateSemanticRoleIsolation } from "../src/lib/semantic-role-isolation";
import { validateAIResponse } from "../src/lib/response-validator";
import { SOLENOS_SYSTEM_PROMPT, SYSTEM_PROMPT_SPEC_MARKERS } from "../src/lib/solenos-langchain-adapter/system-prompt";
import { GEMINI_OUTPUT_SCHEMA } from "../src/lib/gemini-contract";
import { VERIFY_VALID_SOLENOS } from "./fixtures/solenos-valid";
import fs from "node:fs";

console.log("=== Implementation Enforcement Contract ===\n");

for (const marker of SYSTEM_PROMPT_SPEC_MARKERS) {
  if (!SOLENOS_SYSTEM_PROMPT.includes(marker)) {
    throw new Error(`system prompt missing enforcement marker: ${marker}`);
  }
}
console.log("✓ implementation enforcement system prompt markers");

if (!SOLENOS_RISK_LEVELS.includes("critical")) {
  throw new Error("risk_level must include critical tier");
}
if (!GEMINI_OUTPUT_SCHEMA.includes("critical")) {
  throw new Error("gemini schema must include critical risk level");
}
console.log("✓ four-tier risk_level schema (low|medium|high|critical)");

const valid = validateAIResponse(VERIFY_VALID_SOLENOS);
if (!validateSemanticRoleIsolation(valid).valid) {
  throw new Error("fixture must pass semantic role isolation");
}
if (!isOutputCompressionValid(valid)) {
  throw new Error("fixture must pass output compression");
}
console.log("✓ fixture passes semantic + compression gates");

const overWords = validateOutputCompression({
  ...valid,
  what_is_happening: Array.from({ length: 81 }, (_, i) => `word${i}`).join(" "),
});
if (overWords.valid) {
  throw new Error("must reject what_is_happening over 80 words");
}
console.log("✓ enforces 80-word limit on what_is_happening");

const inferenceFail = validateSemanticRoleIsolation(
  validateAIResponse({
    ...valid,
    what_is_happening: "He may be suffering from severe depression.",
  }),
);
if (inferenceFail.valid) {
  throw new Error("must reject unsupported inference in what_is_happening");
}
console.log("✓ blocks unsupported inference while allowing grounded interpretation contract");

for (const field of IMPLEMENTATION_DATABASE_RECORD_FIELDS) {
  if (!RELIEF_VALIDATION_RECORD_FIELDS.includes(field as never)) {
    throw new Error(`database record fields must align: missing ${field}`);
  }
}
assertReliefValidationRecordBoundary([...IMPLEMENTATION_DATABASE_RECORD_FIELDS]);
console.log("✓ database boundary record fields locked");

const pipeline = fs.readFileSync("src/lib/analyze-pipeline/index.ts", "utf-8");
if (!pipeline.includes("isOutputCompressionValid")) {
  throw new Error("analyze pipeline must enforce output compression");
}
if (!pipeline.includes("isSemanticRoleIsolationValid")) {
  throw new Error("analyze pipeline must enforce semantic role isolation");
}
console.log("✓ enforcement gates wired in analyze pipeline");

console.log(`\n✓ ${IMPLEMENTATION_SYSTEM_IDENTITY}`);
console.log(`✓ Purpose: ${IMPLEMENTATION_SYSTEM_PURPOSE}`);
console.log(`✓ Moat: ${IMPLEMENTATION_PRODUCT_MOAT}`);
console.log(`✓ ${IMPLEMENTATION_GROUNDING_PRINCIPLE}`);
console.log(`✓ Priority stack: ${IMPLEMENTATION_PRIORITY_STACK.join(" → ")}`);
console.log(`✓ Compression limits: happening≤${COMPRESSION_LIMITS.what_is_happening_max_words} words`);
console.log(`✓ ${IMPLEMENTATION_FINAL_PRODUCT_TRUTH}`);
