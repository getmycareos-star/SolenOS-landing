import {
  RELIEF_VALIDATION_ARCHITECTURE_FLOW,
  RELIEF_VALIDATION_DRIFT_PREVENTION,
  RELIEF_VALIDATION_FINAL_TRUTH,
  RELIEF_VALIDATION_FORBIDDEN_MEASURES,
  RELIEF_VALIDATION_ONE_LINE_TRUTH,
  RELIEF_VALIDATION_PURPOSE,
  RELIEF_VALIDATION_RECORD_FIELDS,
  assertReliefValidationRecordBoundary,
  classifyReliefOutcome,
  classifyReliefOutcomeAtAnalyze,
  createInitialReliefSignals,
  detectClarificationSignal,
  detectRequerySignal,
  ReliefValidationRecordSchema,
} from "../src/lib/relief-validation";
import { validateAIResponse } from "../src/lib/response-validator";
import { VERIFY_VALID_SOLENOS } from "./fixtures/solenos-valid";
import fs from "node:fs";

console.log("=== Relief Validation Layer — Canonical Contract ===\n");

assertReliefValidationRecordBoundary([...RELIEF_VALIDATION_RECORD_FIELDS]);
console.log("✓ strict interaction-bound relief record fields");

try {
  assertReliefValidationRecordBoundary(["user_profile_score"]);
  throw new Error("user profile field must be rejected");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("disallowed field")) {
    throw error;
  }
}
console.log("✓ forbidden user profiling fields blocked");

if (!detectClarificationSignal("I still don't understand what that means")) {
  throw new Error("clarification signal must be detected");
}
if (detectClarificationSignal("Mom missed her evening medication.")) {
  throw new Error("normal input must not trigger clarification signal");
}
console.log("✓ clarification signal detection");

if (!detectRequerySignal("Did she take her evening dose?", "Did she take her evening dose?")) {
  throw new Error("exact re-query must be detected");
}
if (detectRequerySignal("Mom missed her evening medication.", "Something else entirely.")) {
  throw new Error("unrelated input must not trigger re-query");
}
console.log("✓ re-query signal detection");

const initial = createInitialReliefSignals({
  input: "I still don't understand. Did she take her evening dose?",
  priorInput: "Did she take her evening dose?",
});
const atAnalyze = classifyReliefOutcomeAtAnalyze(initial);
if (atAnalyze !== "failure" && atAnalyze !== "partial") {
  throw new Error(`re-query + clarification should indicate relief stress at analyze: ${atAnalyze}`);
}
console.log("✓ analyze-time relief classification");

const high = classifyReliefOutcome({
  requery_detected: false,
  clarification_detected: false,
  helpful_feedback: true,
  reduced_confusion: true,
});
if (high !== "high") {
  throw new Error(`expected high relief, got ${high}`);
}

const failure = classifyReliefOutcome({
  requery_detected: true,
  clarification_detected: true,
  helpful_feedback: false,
  reduced_confusion: false,
});
if (failure !== "failure") {
  throw new Error(`expected failure relief, got ${failure}`);
}
console.log("✓ post-feedback relief classification");

const output = validateAIResponse(VERIFY_VALID_SOLENOS);
ReliefValidationRecordSchema.parse({
  interaction_id: "00000000-0000-4000-8000-000000000001",
  input_category: "medication",
  output_structured: output,
  structure_valid: true,
  semantic_valid: true,
  latency_ms: 900,
  risk_level: output.risk_level,
  relief_outcome: "none",
  requery_detected: false,
  helpful_feedback: null,
});
console.log("✓ relief validation record schema");

const analyzeRoute = fs.readFileSync("src/app/api/analyze/route.ts", "utf-8");
const feedbackRoute = fs.readFileSync("src/app/api/feedback/route.ts", "utf-8");
const pageSource = fs.readFileSync("src/app/page.tsx", "utf-8");

if (!analyzeRoute.includes("recordReliefMeasurementEvent")) {
  throw new Error("/api/analyze must record relief validation events");
}
if (!feedbackRoute.includes("interaction_id")) {
  throw new Error("/api/feedback must bind feedback to interaction_id");
}
for (const forbidden of RELIEF_VALIDATION_FORBIDDEN_MEASURES) {
  if (pageSource.toLowerCase().includes(forbidden.toLowerCase())) {
    throw new Error(`UI must not surface forbidden measure: ${forbidden}`);
  }
}
console.log("✓ API + UI remain interaction-bound — no engagement surface");

console.log(`\n✓ ${RELIEF_VALIDATION_PURPOSE}`);
console.log(`✓ ${RELIEF_VALIDATION_ARCHITECTURE_FLOW}`);
console.log(`✓ ${RELIEF_VALIDATION_DRIFT_PREVENTION}`);
console.log(`✓ ${RELIEF_VALIDATION_ONE_LINE_TRUTH}`);
console.log(`✓ ${RELIEF_VALIDATION_FINAL_TRUTH}`);
