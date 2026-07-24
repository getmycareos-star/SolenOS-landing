import fs from "node:fs";
import path from "node:path";
import {
  INPUT_CLASSIFICATION_IDENTITY,
  INPUT_CLASSIFICATION_ONE_LINE_TRUTH,
  INPUT_CLASSIFICATION_PIPELINE,
  INPUT_MODES,
  LOW_CONFIDENCE_DEFAULT_MODE,
  classifyInputSurface,
  selectBehaviorProfile,
  applySafetyConstraints,
  formatBehaviorConstraint,
  assertClassifierOutputBoundary,
  InputClassificationResultSchema,
} from "../src/lib/input-classification";
import { buildGeminiExecutionEnvelope } from "../src/lib/gemini-contract";
import { stressNormalizeInput } from "../src/lib/input-stress-normalizer";
import { applyContextWindowStrategy } from "../src/lib/context-window-strategy";
import { SOLENOS_SYSTEM_PROMPT, SYSTEM_PROMPT_SPEC_MARKERS } from "../src/lib/solenos-langchain-adapter/system-prompt";

console.log("=== Input Classification Control System ===\n");

if (!INPUT_CLASSIFICATION_IDENTITY.includes("behavioral control system")) {
  throw new Error("classifier identity drift");
}
if (!INPUT_CLASSIFICATION_ONE_LINE_TRUTH.includes("constraint selection")) {
  throw new Error("one-line truth drift");
}
console.log("✓ classifier identity contract");

if (
  INPUT_CLASSIFICATION_PIPELINE.join(" → ") !==
  "INPUT RECEIVED → INPUT CLASSIFICATION → BEHAVIOR PROFILE SELECTION → SAFETY CONSTRAINT APPLICATION → STRUCTURED OUTPUT GENERATION"
) {
  throw new Error("pipeline order drift");
}
console.log("✓ immutable pipeline order");

if (INPUT_MODES.length !== 4) {
  throw new Error("InputMode union drift");
}
console.log("✓ four InputMode values");

const momForgot = classifyInputSurface("Mom forgot things twice");
const momParsed = InputClassificationResultSchema.parse(momForgot);
if (momParsed.mode !== "emotional_narrative") {
  throw new Error(`"Mom forgot things twice" must be emotional_narrative, got ${momParsed.mode}`);
}
console.log("✓ casual forgetfulness does NOT route to medical_document");

const lab = classifyInputSurface("Attached lab results show HbA1c 8.2");
if (InputClassificationResultSchema.parse(lab).mode !== "medical_document") {
  throw new Error("explicit lab results must route to medical_document");
}
console.log("✓ explicit medical document signals route correctly");

const crisis = classifyInputSurface("She cannot breathe and has chest pain");
if (InputClassificationResultSchema.parse(crisis).mode !== "crisis_urgent") {
  throw new Error("explicit emergency signals must route to crisis_urgent");
}
console.log("✓ explicit crisis signals route correctly");

const admin = classifyInputSurface("Insurance claim denial letter attached");
if (InputClassificationResultSchema.parse(admin).mode !== "administrative_legal") {
  throw new Error("administrative signals must route to administrative_legal");
}
console.log("✓ administrative/legal signals route correctly");

const ambiguous = classifyInputSurface("Mom had a day");
if (InputClassificationResultSchema.parse(ambiguous).mode !== LOW_CONFIDENCE_DEFAULT_MODE) {
  throw new Error("low confidence must default to emotional_narrative");
}
console.log("✓ low confidence defaults to emotional_narrative");

let boundaryFailed = false;
try {
  assertClassifierOutputBoundary({ mode: "emotional_narrative", explanation: "bad" });
} catch {
  boundaryFailed = true;
}
if (!boundaryFailed) {
  throw new Error("classifier must reject forbidden output keys");
}
console.log("✓ classifier output boundary (mode + confidence only)");

const profile = applySafetyConstraints(
  selectBehaviorProfile({ mode: "crisis_urgent" }),
);
const constraint = formatBehaviorConstraint(profile);
if (!constraint.includes("INPUT_MODE: crisis_urgent")) {
  throw new Error("behavior constraint must include INPUT_MODE");
}
console.log("✓ behavior profile selection + constraint formatting");

const pipelineSource = fs.readFileSync(
  path.join(process.cwd(), "src/lib/analyze-pipeline/index.ts"),
  "utf-8",
);
const classifyIdx = pipelineSource.indexOf("classifyInputSurface(structuredInput.raw_input)");
const documentIdx = pipelineSource.indexOf("applyDocumentIntake(structuredInput)");
const contextIdx = pipelineSource.indexOf("applyContextWindowStrategy(structuredInput)");
const geminiIdx = pipelineSource.indexOf("invokeGeminiExecution({");

if (!(classifyIdx > 0 && classifyIdx < documentIdx && documentIdx < contextIdx && contextIdx < geminiIdx)) {
  throw new Error("classification must run before document intake, context window, and LLM");
}
console.log("✓ analyze pipeline: classification before generation steps");

const envelope = buildGeminiExecutionEnvelope(
  applyContextWindowStrategy(stressNormalizeInput("I'm overwhelmed and confused")),
  false,
  null,
  { behaviorProfile: profile },
);
if (!envelope.user.includes("BEHAVIOR_CONSTRAINT:")) {
  throw new Error("gemini envelope must include BEHAVIOR_CONSTRAINT when profile provided");
}
console.log("✓ behavior profile wired into gemini envelope");

for (const marker of SYSTEM_PROMPT_SPEC_MARKERS) {
  if (!SOLENOS_SYSTEM_PROMPT.includes(marker)) {
    throw new Error(`system prompt missing marker: ${marker}`);
  }
}
console.log("✓ system prompt includes classification control markers");

console.log("\n✓ Input Classification Control System enforced");
