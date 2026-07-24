import fs from "node:fs";
import path from "node:path";
import {
  GLOBAL_EXECUTION_PIPELINE,
  OBSERVATION_PRINCIPLE,
  SYSTEM_TYPE,
  FINAL_IMPLEMENTATION_TRUTH,
  FINAL_SYSTEM_TRUTH,
  FINAL_IMPLEMENTATION_OUTPUT_FIELDS,
  FINAL_IMPLEMENTATION_FORBIDDEN_SYSTEM_TYPES,
} from "../src/lib/final-implementation-contract";
import {
  ONE_LINE_TRUTH,
  THREE_OPERATIONS,
} from "../src/lib/cognitive-compression";
import {
  assertObservationOnly as assertDepletionObservationOnly,
  classifyCaregiverDepletionSignals,
  CaregiverDepletionSignalsResultSchema,
  CAREGIVER_DEPLETION_BOUNDARY,
} from "../src/lib/caregiver-depletion-signals";
import { classifyCareContextState } from "../src/lib/post-care-insight";
import { detectUrgencyLevel } from "../src/lib/urgency-detection";
import { classifyInputSurface } from "../src/lib/input-classification";
import { SolenOSResponseSchema } from "../src/lib/response-validator";
import { GEMINI_OUTPUT_SCHEMA } from "../src/lib/gemini-contract";
import { SOLENOS_SYSTEM_PROMPT, SYSTEM_PROMPT_SPEC_MARKERS } from "../src/lib/solenos-langchain-adapter/system-prompt";
import { TelemetryInteractionInsertSchema } from "../src/lib/telemetry-persistence";
import { TELEMETRY_CAREGIVER_DEPLETION_RULE } from "../src/lib/telemetry-persistence/contract-constants";
import { VERIFY_VALID_SOLENOS } from "./fixtures/solenos-valid";

console.log("=== SolenOS Final Implementation Contract ===\n");

if (!SYSTEM_TYPE.includes("cognitive compression engine")) {
  throw new Error("SYSTEM_TYPE drift");
}
if (!FINAL_IMPLEMENTATION_TRUTH.includes("never intervenes")) {
  throw new Error("FINAL_IMPLEMENTATION_TRUTH drift");
}
if (!FINAL_IMPLEMENTATION_TRUTH.includes("responsibility loops")) {
  throw new Error("FINAL_IMPLEMENTATION_TRUTH must align with cognitive compression spec");
}
if (FINAL_SYSTEM_TRUTH !== FINAL_IMPLEMENTATION_TRUTH) {
  throw new Error("FINAL_SYSTEM_TRUTH alias drift");
}
if (!ONE_LINE_TRUTH.includes("responsibility loops")) {
  throw new Error("cognitive compression ONE_LINE_TRUTH drift");
}
if (THREE_OPERATIONS.length !== 3) {
  throw new Error("cognitive compression THREE_OPERATIONS drift");
}
if (!OBSERVATION_PRINCIPLE.includes("intervention NOT")) {
  throw new Error("observation principle must state intervention NOT");
}
if (FINAL_IMPLEMENTATION_FORBIDDEN_SYSTEM_TYPES.length < 5) {
  throw new Error("forbidden system types drift");
}
console.log("✓ final implementation contract constants");

if (GLOBAL_EXECUTION_PIPELINE.length !== 10) {
  throw new Error("GLOBAL_EXECUTION_PIPELINE must have 10 ordered steps");
}
if (GLOBAL_EXECUTION_PIPELINE[3] !== "SIGNAL EXTRACTION") {
  throw new Error("step 4 must be SIGNAL EXTRACTION");
}
if (GLOBAL_EXECUTION_PIPELINE[9] !== "RELIEF + SIGNAL LOGGING") {
  throw new Error("step 10 must be RELIEF + SIGNAL LOGGING");
}
console.log("✓ 10-step global execution pipeline defined");

if (FINAL_IMPLEMENTATION_OUTPUT_FIELDS.length !== 5) {
  throw new Error("output must be exactly 5 fields");
}
const schemaKeys = Object.keys(SolenOSResponseSchema.parse(VERIFY_VALID_SOLENOS));
if (schemaKeys.length !== 5) {
  throw new Error("runtime schema must remain 5 fields");
}
if (GEMINI_OUTPUT_SCHEMA.includes("caregiver_depletion") || GEMINI_OUTPUT_SCHEMA.includes("care_context_state")) {
  throw new Error("gemini output schema must not include observational signal fields");
}
console.log("✓ 5-field output schema unchanged");

const migration = fs.readFileSync("db/migrations/007_caregiver_depletion_signals.sql", "utf-8");
if (!migration.includes("caregiver_depletion_state") || !migration.includes("is_single_caregiver")) {
  throw new Error("migration 007 must add depletion signal columns");
}
if (!migration.includes("environmental_dependency_flag")) {
  throw new Error("migration 007 must add environmental_dependency_flag");
}
if (/\busers\b/i.test(migration) && /ALTER TABLE users/i.test(migration)) {
  throw new Error("depletion signals must be on interactions only");
}
console.log("✓ migration 007 adds depletion signals to interactions only");

const elevated = classifyCaregiverDepletionSignals(
  "I only slept 2 hours and no one else helping with 24/7 caregiving.",
);
if (elevated.caregiver_depletion_state !== "critical") {
  throw new Error("combined explicit depletion signals must classify critical");
}
if (elevated.is_single_caregiver !== true) {
  throw new Error("is_single_caregiver must be true only when explicitly stated");
}
const normal = classifyCaregiverDepletionSignals("Mom missed her medication.");
if (normal.caregiver_depletion_state !== "normal" || normal.is_single_caregiver !== false) {
  throw new Error("low-signal input must default normal / not single caregiver");
}
const env = classifyCaregiverDepletionSignals(
  "I can't leave the monitor and rely on the beeps to feel stable.",
);
if (env.environmental_dependency_flag !== "support_anchor_present") {
  throw new Error("environmental dependency must detect support_anchor_present");
}
CaregiverDepletionSignalsResultSchema.parse({
  caregiver_depletion_state: elevated.caregiver_depletion_state,
  is_single_caregiver: elevated.is_single_caregiver,
  environmental_dependency_flag: elevated.environmental_dependency_flag,
});
console.log("✓ caregiver depletion classifier");

if (!CAREGIVER_DEPLETION_BOUNDARY.includes("LABEL ONLY")) {
  throw new Error("depletion boundary must state LABEL ONLY");
}
assertDepletionObservationOnly({
  usesForRouting: false,
  usesForUiBranching: false,
  usesForSchemaChange: false,
  usesForIntervention: false,
});
try {
  assertDepletionObservationOnly({ usesForIntervention: true });
  throw new Error("assertObservationOnly must reject intervention");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("anti-drift")) {
    throw error;
  }
}
console.log("✓ caregiver depletion signals observational only");

const pipelineSource = fs.readFileSync(
  path.join(process.cwd(), "src/lib/analyze-pipeline/index.ts"),
  "utf-8",
);

const stepMarkers = [
  "Step 1: INPUT RECEIVED",
  "Step 2: INPUT CLASSIFICATION",
  "Step 3: URGENCY DETECTION",
  "Step 4: SIGNAL EXTRACTION",
  "Step 5: MODE CONSTRAINT SELECTION",
  "Step 6: SAFETY OVERRIDE",
  "Step 7: OUTPUT CONTRACT ENFORCEMENT",
  "Step 8: STRUCTURED RESPONSE GENERATION",
  "Step 9: RESPONSE VALIDATION",
];
for (const marker of stepMarkers) {
  if (!pipelineSource.includes(marker)) {
    throw new Error(`analyze pipeline missing step marker: ${marker}`);
  }
}

const classifyIdx = pipelineSource.indexOf("classifyInputSurface(structuredInput.raw_input)");
const urgencyIdx = pipelineSource.indexOf("detectUrgencyLevel(");
const signalIdx = pipelineSource.indexOf("classifyCareContextState({");
const depletionIdx = pipelineSource.indexOf("classifyCaregiverDepletionSignals(");
const modeIdx = pipelineSource.indexOf("selectBehaviorProfile(inputClassification)");
const safetyIdx = pipelineSource.indexOf("applySafetyOverrideCheck(urgencyDetection");
const preLlmIdx = pipelineSource.indexOf("applyDocumentIntake(structuredInput)");
const geminiIdx = pipelineSource.indexOf("invokeGeminiExecution({");
const validationIdx = pipelineSource.indexOf("Step 9: RESPONSE VALIDATION");

if (
  !(
    classifyIdx < urgencyIdx &&
    urgencyIdx < signalIdx &&
    signalIdx < depletionIdx &&
    depletionIdx < modeIdx &&
    modeIdx < safetyIdx &&
    safetyIdx < preLlmIdx &&
    preLlmIdx < geminiIdx &&
    geminiIdx < validationIdx
  )
) {
  throw new Error("pipeline order violation in analyze-pipeline");
}
if (!pipelineSource.includes("observationTags: [")) {
  throw new Error("pipeline must pass observation tags to envelope");
}
if (!pipelineSource.includes("formatGuiltReplayObservation")) {
  throw new Error("pipeline must pass guilt replay observation tag");
}
console.log("✓ analyze pipeline 10-step order enforced");

const pageSource = fs.readFileSync("src/app/page.tsx", "utf-8");
const outputRenderer = fs.readFileSync("src/components/OutputRenderer.tsx", "utf-8");
for (const source of [pageSource, outputRenderer]) {
  if (/caregiver_depletion|is_single_caregiver|environmental_dependency/i.test(source)) {
    throw new Error("UX must not branch on caregiver depletion signals");
  }
}
console.log("✓ no UI branching on depletion signals");

const analyzeRoute = fs.readFileSync("src/app/api/analyze/route.ts", "utf-8");
if (!analyzeRoute.includes("recordReliefMeasurementEvent")) {
  throw new Error("step 10 relief logging must occur in analyze route");
}
if (!analyzeRoute.includes("caregiver_depletion_state")) {
  throw new Error("analyze route must persist depletion signals");
}
console.log("✓ relief + signal logging wired in analyze route");

if (!TELEMETRY_CAREGIVER_DEPLETION_RULE.includes("forbidden")) {
  throw new Error("telemetry depletion rule drift");
}
const output = SolenOSResponseSchema.parse(VERIFY_VALID_SOLENOS);
TelemetryInteractionInsertSchema.parse({
  user_id: "00000000-0000-4000-8000-000000000001",
  input_raw: "I only slept 2 hours, no one else helping.",
  output_structured: output,
  risk_level: output.risk_level,
  latency_ms: 900,
  structure_valid: true,
  semantic_valid: true,
  input_category: "general",
  relief_outcome: "none",
  requery_detected: false,
  helpful_feedback: null,
  care_context_state: "active_care",
  caregiver_depletion_state: "elevated",
  is_single_caregiver: true,
  environmental_dependency_flag: "none",
});
console.log("✓ telemetry schema accepts depletion signals on interactions only");

const crisisInput = classifyInputSurface("she is not breathing");
const crisis = classifyCareContextState({
  input: "she is not breathing",
  inputMode: crisisInput.mode,
  urgencyDetection: detectUrgencyLevel("she is not breathing", crisisInput.mode),
});
if (crisis.care_context_state !== "crisis") {
  throw new Error("care_context_state signal extraction must still classify crisis");
}
console.log("✓ care_context_state signal extraction intact");

for (const marker of SYSTEM_PROMPT_SPEC_MARKERS) {
  if (!SOLENOS_SYSTEM_PROMPT.includes(marker)) {
    throw new Error(`system prompt missing marker: ${marker}`);
  }
}
console.log("✓ system prompt observational signal markers");

console.log(`\n✓ ${OBSERVATION_PRINCIPLE}`);
console.log(`✓ ${FINAL_IMPLEMENTATION_TRUTH}`);
