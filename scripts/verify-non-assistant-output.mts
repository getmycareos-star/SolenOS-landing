import fs from "node:fs";
import path from "node:path";
import {
  isNonAssistantOutputValid,
  NON_ASSISTANT_FORBIDDEN_PATTERN_COUNT,
  NON_ASSISTANT_OUTPUT_ONE_LINE_TRUTH,
  validateNonAssistantOutput,
  CONVERSATIONAL_PATTERNS,
  ASSISTANT_CONTINUATION_PATTERNS,
  NARRATIVE_PATTERNS,
  EMOTIONAL_EXPANSION_PATTERNS,
} from "../src/lib/non-assistant-output";
import { withMeta } from "../src/lib/response-validator";
import {
  classifyNonAssistantOutputFailure,
  FailureLogEntrySchema,
} from "../src/lib/failure-observability";
import { SOLENOS_SYSTEM_PROMPT, SYSTEM_PROMPT_SPEC_MARKERS } from "../src/lib/solenos-langchain-adapter/system-prompt";
import { VERIFY_VALID_SOLENOS } from "./fixtures/solenos-valid";

console.log("=== Non-Assistant Output Contract (Style Validation) ===\n");

for (const marker of SYSTEM_PROMPT_SPEC_MARKERS) {
  if (!SOLENOS_SYSTEM_PROMPT.includes(marker)) {
    throw new Error(`system prompt missing marker: ${marker}`);
  }
}
if (!SOLENOS_SYSTEM_PROMPT.includes("NON-ASSISTANT OUTPUT CONTRACT")) {
  throw new Error("system prompt missing non-assistant output contract");
}
console.log("✓ non-assistant output contract in system prompt");

const patternCount =
  CONVERSATIONAL_PATTERNS.length +
  ASSISTANT_CONTINUATION_PATTERNS.length +
  NARRATIVE_PATTERNS.length +
  EMOTIONAL_EXPANSION_PATTERNS.length;
if (patternCount !== NON_ASSISTANT_FORBIDDEN_PATTERN_COUNT) {
  throw new Error("forbidden pattern count mismatch");
}
if (patternCount < 20) {
  throw new Error("expected at least 20 forbidden patterns");
}
console.log(`✓ ${patternCount} forbidden patterns across 4 categories`);

const conversationalSample = "It sounds like you may be experiencing stress about the missed dose.";
if (!CONVERSATIONAL_PATTERNS.some((p) => p.test(conversationalSample))) {
  throw new Error("conversational patterns must detect spec phrases");
}
console.log("✓ forbidden conversational patterns detected");

const safe = withMeta(VERIFY_VALID_SOLENOS);
if (!isNonAssistantOutputValid(safe)) {
  throw new Error("valid fixture must pass non-assistant style gate");
}
console.log("✓ valid structured output passes style gate");

const assistantStyle = withMeta({
  ...VERIFY_VALID_SOLENOS,
  what_is_happening: "It sounds like the evening medication was missed based on what you shared.",
});
if (isNonAssistantOutputValid(assistantStyle)) {
  throw new Error("assistant-style conversational output must fail");
}
console.log("✓ assistant-style output fails style gate");

const continuationStyle = withMeta({
  ...VERIFY_VALID_SOLENOS,
  what_can_wait: "Insurance calls can wait. Let me know if you need help with anything else.",
});
if (isNonAssistantOutputValid(continuationStyle)) {
  throw new Error("assistant continuation must fail");
}
console.log("✓ assistant continuation patterns fail style gate");

const narrativeStyle = withMeta({
  ...VERIFY_VALID_SOLENOS,
  what_matters_now: "Here's why confirming the dose matters — medication timing affects stability.",
});
const narrativeResult = validateNonAssistantOutput(narrativeStyle);
if (narrativeResult.valid || !narrativeResult.violations.includes("narrative")) {
  throw new Error("narrative reasoning must fail");
}
console.log("✓ narrative patterns fail style gate");

FailureLogEntrySchema.parse({
  timestamp: new Date().toISOString(),
  stage: "postprocess",
  failure_type: classifyNonAssistantOutputFailure().failure_type,
  retry_count: 0,
});
console.log("✓ NON_ASSISTANT_OUTPUT_FAILURE logged via observability");

const pipelineSource = fs.readFileSync(
  path.join(process.cwd(), "src/lib/analyze-pipeline/index.ts"),
  "utf-8",
);
const qualityIdx = pipelineSource.indexOf("if (!isOutputQualityValid(epistemicOutput))");
const styleIdx = pipelineSource.indexOf("if (!isNonAssistantOutputValid(epistemicOutput))");
const publishIdx = pipelineSource.indexOf("publishLastFailureLogs(collector.getLogs());", styleIdx);
if (!(qualityIdx > 0 && styleIdx > qualityIdx && publishIdx > styleIdx)) {
  throw new Error("style validation must run after quality gate and before success return");
}
console.log("✓ pipeline includes style validation before return");

if (/anti-ChatGPT|anti-chatgpt|AntiChatGPTEngine/i.test(pipelineSource)) {
  throw new Error("pipeline must not reference dedicated anti-ChatGPT engine module");
}
const libDirs = fs.readdirSync(path.join(process.cwd(), "src/lib"));
if (libDirs.some((d) => /anti-chatgpt|anti-chatgpt-engine/i.test(d))) {
  throw new Error("architecture must not include dedicated anti-ChatGPT engine module");
}
console.log("✓ no dedicated anti-ChatGPT engine module in architecture");

console.log(`\n✓ ${NON_ASSISTANT_OUTPUT_ONE_LINE_TRUTH}`);
