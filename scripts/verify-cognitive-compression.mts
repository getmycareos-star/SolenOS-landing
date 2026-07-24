import fs from "node:fs";
import path from "node:path";
import {
  COGNITIVE_COMPRESSION_SYSTEM_TYPE,
  COGNITIVE_COMPRESSION_ONE_LINE_TRUTH,
  SYSTEM_TYPE,
  ONE_LINE_TRUTH,
  SUCCESS_DEFINITION,
  THREE_OPERATIONS,
  FORBIDDEN_OPERATIONS,
  CORE_TRANSFORMATIONS,
  FORBIDDEN_SYSTEM_TYPES,
  VERBOSITY_TOTAL_WORD_LIMITS,
  GUILT_REPLAY_PATTERNS,
  detectGuiltReplayPatterns,
  detectGuiltLoopPatterns,
  formatGuiltReplayObservation,
  validateGuiltReplayInterruption,
  validateCompressionConstraints,
  validateActionRelevantChange,
  validateCognitiveCompression,
  isCognitiveCompressionValid,
} from "../src/lib/cognitive-compression";
import {
  classifyCognitiveCompressionFailure,
  FailureLogEntrySchema,
} from "../src/lib/failure-observability";
import { validateOutputCompression } from "../src/lib/implementation-enforcement";
import { SOLENOS_RISK_LEVELS, normalizeRiskLevel } from "../src/lib/implementation-enforcement/risk-levels";
import { SolenOSResponseSchema, validateAIResponse } from "../src/lib/response-validator";
import { SOLENOS_SYSTEM_PROMPT, SYSTEM_PROMPT_SPEC_MARKERS } from "../src/lib/solenos-langchain-adapter/system-prompt";
import { GEMINI_OUTPUT_SCHEMA } from "../src/lib/gemini-contract";
import { VERIFY_VALID_SOLENOS } from "./fixtures/solenos-valid";

console.log("=== SolenOS Cognitive Compression Contract ===\n");

if (!COGNITIVE_COMPRESSION_SYSTEM_TYPE.includes("cognitive compression engine")) {
  throw new Error("system type drift");
}
if (!ONE_LINE_TRUTH.includes("responsibility loops")) {
  throw new Error("one-line truth drift");
}
if (SYSTEM_TYPE !== COGNITIVE_COMPRESSION_SYSTEM_TYPE) {
  throw new Error("SYSTEM_TYPE alias drift");
}
if (ONE_LINE_TRUTH !== COGNITIVE_COMPRESSION_ONE_LINE_TRUTH) {
  throw new Error("ONE_LINE_TRUTH alias drift");
}
if (THREE_OPERATIONS.length !== 3 || THREE_OPERATIONS !== CORE_TRANSFORMATIONS) {
  throw new Error("THREE_OPERATIONS alias drift");
}
if (FORBIDDEN_OPERATIONS.length < 8) {
  throw new Error("FORBIDDEN_OPERATIONS drift");
}
if (!SUCCESS_DEFINITION.includes("responsibility loops")) {
  throw new Error("SUCCESS_DEFINITION drift");
}
if (GUILT_REPLAY_PATTERNS.length < 3) {
  throw new Error("GUILT_REPLAY_PATTERNS drift");
}
if (CORE_TRANSFORMATIONS.length !== 3) {
  throw new Error("must define exactly 3 core transformations");
}
if (FORBIDDEN_SYSTEM_TYPES.length < 5) {
  throw new Error("forbidden system types drift");
}
console.log("✓ cognitive compression contract constants");

if (SOLENOS_RISK_LEVELS.join("|") !== "low|medium|high|critical") {
  throw new Error("risk_level must be lowercase enum");
}
if (normalizeRiskLevel("MEDIUM") !== "medium" || normalizeRiskLevel("low") !== "low") {
  throw new Error("normalizeRiskLevel must accept legacy uppercase and canonical lowercase");
}
if (!GEMINI_OUTPUT_SCHEMA.includes('"low"') || GEMINI_OUTPUT_SCHEMA.includes('"LOW"')) {
  throw new Error("gemini schema must use lowercase risk levels");
}
console.log("✓ lowercase risk_level with legacy uppercase normalization");

const schemaKeys = Object.keys(SolenOSResponseSchema.parse(VERIFY_VALID_SOLENOS));
if (schemaKeys.length !== 5) {
  throw new Error("output schema must remain exactly 5 fields");
}
if (GEMINI_OUTPUT_SCHEMA.includes("follow_up_items") || GEMINI_OUTPUT_SCHEMA.includes("_meta")) {
  throw new Error("gemini schema must not include extra fields");
}
console.log("✓ 5-field output schema with no extras");

for (const marker of SYSTEM_PROMPT_SPEC_MARKERS) {
  if (!SOLENOS_SYSTEM_PROMPT.includes(marker)) {
    throw new Error(`system prompt missing marker: ${marker}`);
  }
}
console.log("✓ cognitive compression system prompt markers");

const valid = validateAIResponse(VERIFY_VALID_SOLENOS);
if (!isCognitiveCompressionValid(valid)) {
  throw new Error("valid fixture must pass unified cognitive compression gate");
}
if (!validateCognitiveCompression(valid).valid) {
  throw new Error("validateCognitiveCompression must accept valid fixture");
}
console.log("✓ shared fixture passes cognitive compression gates");

if (!detectGuiltReplayPatterns("I should have noticed the missed dose. What if I missed something?")) {
  throw new Error("must detect guilt replay input patterns");
}
if (!detectGuiltLoopPatterns("Did I fail to call the doctor?")) {
  throw new Error("detectGuiltLoopPatterns alias must detect guilt replay input");
}
const guiltTag = formatGuiltReplayObservation(true);
if (!guiltTag?.includes("GUILT_REPLAY_SIGNAL")) {
  throw new Error("guilt replay observation tag must be observational only");
}
if (formatGuiltReplayObservation(false) !== null) {
  throw new Error("guilt replay observation must be null when not detected");
}

const guiltValidated = validateGuiltReplayInterruption(
  validateAIResponse({
    ...VERIFY_VALID_SOLENOS,
    what_is_happening: "You clearly failed to notice the missed dose and it was your fault.",
  }),
  "I should have noticed the missed dose.",
);
if (guiltValidated.valid) {
  throw new Error("guilt narrative validation must fail");
}
console.log("✓ blocks guilt narrative validation");

const emotionalExpansion = validateGuiltReplayInterruption(
  validateAIResponse({
    ...VERIFY_VALID_SOLENOS,
    what_is_happening: "It's understandable that you feel guilty about this situation.",
  }),
);
if (emotionalExpansion.valid) {
  throw new Error("emotional analysis expansion must fail");
}
console.log("✓ blocks emotional analysis expansion");

const multiPath = validateCompressionConstraints(
  validateAIResponse({
    ...VERIFY_VALID_SOLENOS,
    what_is_happening: "On the one hand it could be fatigue, on the other hand it could be infection.",
  }),
);
if (multiPath.valid) {
  throw new Error("multi-path reasoning must fail");
}
console.log("✓ blocks multi-path reasoning");

const backgroundOnly = validateActionRelevantChange(
  validateAIResponse({
    ...VERIFY_VALID_SOLENOS,
    what_matters_now: "For context, over time caregivers often face long-term background stress.",
  }),
);
if (backgroundOnly.valid) {
  throw new Error("background-only what_matters_now must fail");
}
console.log("✓ requires action-relevant change in what_matters_now");

if (
  VERBOSITY_TOTAL_WORD_LIMITS.low !== 80 ||
  VERBOSITY_TOTAL_WORD_LIMITS.medium !== 80 ||
  VERBOSITY_TOTAL_WORD_LIMITS.high !== 120 ||
  VERBOSITY_TOTAL_WORD_LIMITS.critical !== 60
) {
  throw new Error("verbosity total word limits drift");
}

const overTotal = validateOutputCompression({
  ...valid,
  what_is_happening: Array.from({ length: 50 }, (_, i) => `word${i}`).join(" "),
  what_matters_now: Array.from({ length: 40 }, (_, i) => `matter${i}`).join(" "),
});
if (overTotal.valid || !overTotal.violations.includes("total_over_word_limit")) {
  throw new Error("medium output must enforce 80-word total limit");
}
console.log("✓ enforces total word limits by risk_level");

const pipelineSource = fs.readFileSync(
  path.join(process.cwd(), "src/lib/analyze-pipeline/index.ts"),
  "utf-8",
);
if (!pipelineSource.includes("isCognitiveCompressionValid")) {
  throw new Error("analyze pipeline must wire unified cognitive compression gate");
}
if (!pipelineSource.includes("formatGuiltReplayObservation")) {
  throw new Error("analyze pipeline must pass guilt replay observation tag");
}
console.log("✓ cognitive compression gates wired in analyze pipeline");

FailureLogEntrySchema.parse({
  timestamp: new Date().toISOString(),
  stage: "postprocess",
  failure_type: classifyCognitiveCompressionFailure().failure_type,
  retry_count: 0,
});
console.log("✓ COGNITIVE_COMPRESSION_FAILURE logged via observability");

console.log(`\n✓ ${COGNITIVE_COMPRESSION_SYSTEM_TYPE}`);
