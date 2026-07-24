import fs from "node:fs";
import path from "node:path";
import {
  FINAL_BUILD_PIPELINE,
  FINAL_BUILD_OUTPUT_FIELDS,
  FINAL_BUILD_SYSTEM_TYPE,
  FINAL_BUILD_ONE_LINE_TRUTH,
} from "../src/lib/final-build-contract";
import { detectUrgencyLevel } from "../src/lib/urgency-detection";
import {
  applySafetyOverrideCheck,
  CRITICAL_TOTAL_MAX_WORDS,
  HIGH_TOTAL_MAX_WORDS,
  isSafetyOverrideValid,
} from "../src/lib/safety-override";
import { selectBehaviorProfile } from "../src/lib/input-classification";
import { SOLENOS_RISK_LEVELS } from "../src/lib/implementation-enforcement/risk-levels";
import { SolenOSResponseSchema } from "../src/lib/response-validator";
import { SOLENOS_SYSTEM_PROMPT, SYSTEM_PROMPT_SPEC_MARKERS } from "../src/lib/solenos-langchain-adapter/system-prompt";
import { GEMINI_OUTPUT_SCHEMA } from "../src/lib/gemini-contract";
import { VERIFY_VALID_SOLENOS } from "./fixtures/solenos-valid";

console.log("=== Final Build Implementation Spec ===\n");

if (!FINAL_BUILD_SYSTEM_TYPE.includes("cognitive compression engine")) {
  throw new Error("system type drift");
}
if (!FINAL_BUILD_ONE_LINE_TRUTH.includes("responsibility loops")) {
  throw new Error("one-line truth drift");
}
console.log("✓ system type contract");

if (FINAL_BUILD_PIPELINE.length !== 8) {
  throw new Error("pipeline must have 8 ordered steps");
}
console.log("✓ 8-step global pipeline defined");

if (FINAL_BUILD_OUTPUT_FIELDS.length !== 5) {
  throw new Error("output must be exactly 5 fields");
}
console.log("✓ 5-field output schema");

if (SOLENOS_RISK_LEVELS.join("|") !== "low|medium|high|critical") {
  throw new Error("risk_level must be lowercase enum");
}
console.log("✓ lowercase risk_level enum");

const schemaKeys = Object.keys(SolenOSResponseSchema.parse(VERIFY_VALID_SOLENOS));
if (schemaKeys.length !== 5 || schemaKeys.includes("follow_up_items")) {
  throw new Error("runtime schema must reject follow_up_items");
}
console.log("✓ follow_up_items removed from runtime schema");

if (!GEMINI_OUTPUT_SCHEMA.includes('"low"') || GEMINI_OUTPUT_SCHEMA.includes("follow_up_items")) {
  throw new Error("gemini schema must use lowercase risk and 5 fields");
}
console.log("✓ gemini envelope schema aligned");

const critical = detectUrgencyLevel("She is not breathing and passed out");
if (critical.risk_level !== "critical") {
  throw new Error("not breathing must detect critical");
}
console.log("✓ critical urgency detection");

const high = detectUrgencyLevel("Mom had repeated falls and worsening symptoms");
if (high.risk_level !== "high") {
  throw new Error("repeated falls must detect high");
}
console.log("✓ high urgency detection");

const profile = selectBehaviorProfile({ mode: "emotional_narrative" });
const safety = applySafetyOverrideCheck(critical, profile);
if (!safety.state.active || safety.constraint_line?.includes("CRITICAL") !== true) {
  throw new Error("safety override must activate on CRITICAL");
}
console.log("✓ safety override check");

const criticalOutput = {
  what_is_happening: "Caregiver reports person not breathing.",
  what_matters_now: "🔴 CRITICAL — Call 911 immediately and seek emergency medical care.",
  what_to_ask_next: "Is anyone performing CPR?",
  risk_level: "critical" as const,
  what_can_wait: "All non-emergency tasks.",
};
if (!isSafetyOverrideValid(criticalOutput, safety.state)) {
  throw new Error("valid CRITICAL output must pass safety override");
}
console.log("✓ CRITICAL safety override validation");

if (CRITICAL_TOTAL_MAX_WORDS !== 60 || HIGH_TOTAL_MAX_WORDS !== 120) {
  throw new Error("word limits must be 60 CRITICAL / 120 HIGH");
}
console.log("✓ safety override word limits");

const pipelineSource = fs.readFileSync(
  path.join(process.cwd(), "src/lib/analyze-pipeline/index.ts"),
  "utf-8",
);
const classifyIdx = pipelineSource.indexOf("classifyInputSurface(structuredInput.raw_input)");
const urgencyIdx = pipelineSource.indexOf("detectUrgencyLevel(");
const modeIdx = pipelineSource.indexOf("selectBehaviorProfile(inputClassification)");
const safetyIdx = pipelineSource.indexOf("applySafetyOverrideCheck(urgencyDetection");
const geminiIdx = pipelineSource.indexOf("invokeGeminiExecution({");

if (!(classifyIdx < urgencyIdx && urgencyIdx < modeIdx && modeIdx < safetyIdx && safetyIdx < geminiIdx)) {
  throw new Error("pipeline order: classification → urgency → mode → safety → generation");
}
console.log("✓ analyze pipeline order enforced");

for (const marker of SYSTEM_PROMPT_SPEC_MARKERS) {
  if (!SOLENOS_SYSTEM_PROMPT.includes(marker)) {
    throw new Error(`system prompt missing marker: ${marker}`);
  }
}
console.log("✓ system prompt final build markers");

console.log("\n✓ Final Build Implementation Spec enforced");
