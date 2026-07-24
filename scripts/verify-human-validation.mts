import fs from "node:fs";

import {

  TelemetryFeedbackSubmitSchema,

  getMemoryTelemetryStore,

  resetMemoryTelemetryStore,

} from "../src/lib/telemetry-persistence";

import { validateAIResponse } from "../src/lib/response-validator";

import { VERIFY_VALID_SOLENOS } from "./fixtures/solenos-valid";



console.log("=== Human Validation Loop — Relief Signal Contract ===\n");



resetMemoryTelemetryStore();

const store = getMemoryTelemetryStore();

const { user_id } = await store.ensureUser();

const output = validateAIResponse(VERIFY_VALID_SOLENOS);

const recorded = await store.recordReliefEvent({

  user_id,

  input_raw: "Mom missed her evening medication.",

  output_structured: output,

  risk_level: output.risk_level,

  latency_ms: 1000,

  structure_valid: true,

  semantic_valid: true,

  input_category: "medication",

  relief_outcome: "none",

  requery_detected: false,

  helpful_feedback: null,

  care_context_state: "uncertain",

  caregiver_depletion_state: "normal",

  is_single_caregiver: false,

  environmental_dependency_flag: "none",

});



const payload = TelemetryFeedbackSubmitSchema.parse({

  interaction_id: recorded.interaction_id,

  helpful_yes_no: true,

  reduced_confusion_yes_no: false,

});

await store.recordFeedback(payload);



if (Object.keys(payload).length !== 3) {

  throw new Error("feedback must contain exactly three fields");

}

console.log("✓ strict interaction-bound feedback contract");



const rejectExtra = TelemetryFeedbackSubmitSchema.safeParse({

  interaction_id: recorded.interaction_id,

  helpful_yes_no: true,

  reduced_confusion_yes_no: false,

  narrative: "caregiver story",

});

if (rejectExtra.success) {

  throw new Error("submit schema must reject extra fields");

}

console.log("✓ submit schema rejects extra fields");



const feedbackRoute = fs.readFileSync("src/app/api/feedback/route.ts", "utf-8");

const analyzeRoute = fs.readFileSync("src/app/api/analyze/route.ts", "utf-8");

const pipeline = fs.readFileSync("src/lib/analyze-pipeline/index.ts", "utf-8");



if (analyzeRoute.includes("human-validation") || pipeline.includes("human-validation")) {

  throw new Error("validation loop must not influence analyze pipeline");

}

if (!feedbackRoute.includes("recordReliefFeedback")) {

  throw new Error("feedback route must store relief validation signal only");

}

console.log("✓ feedback isolated from core transformation pipeline");



const ui = fs.readFileSync("src/components/HumanValidationLoop.tsx", "utf-8");

if (!ui.includes("Was this helpful?")) {

  throw new Error("required question missing from UI");

}

if (!ui.includes("Did this reduce confusion?")) {

  throw new Error("confusion question missing from UI");

}

if (!ui.includes("interaction_id")) {

  throw new Error("feedback must bind to interaction_id");

}

if (!ui.includes("care_key")) {

  throw new Error("feedback may include optional care_key for load/containment");

}

if (ui.includes("textarea") || ui.includes("<input")) {

  throw new Error("validation loop must not include text input");

}

console.log("✓ binary tap-only UX contract");



console.log("\n✓ human validation loop is relief indicator for output effectiveness only");


