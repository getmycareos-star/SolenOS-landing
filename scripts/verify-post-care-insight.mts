import fs from "node:fs";
import path from "node:path";
import {
  assertObservationOnly,
  assertClassifierOutputBoundary,
  CareContextStateResultSchema,
  classifyCareContextState,
  POST_CARE_INSIGHT_ANTI_DRIFT_RULES,
  POST_CARE_INSIGHT_BOUNDARY,
  POST_CARE_INSIGHT_FORBIDDEN_USES,
  POST_CARE_INSIGHT_ONE_LINE_TRUTH,
  applyPostCareToneAdjustment,
  formatCareContextObservation,
} from "../src/lib/post-care-insight";
import { detectUrgencyLevel } from "../src/lib/urgency-detection";
import { classifyInputSurface, selectBehaviorProfile } from "../src/lib/input-classification";
import { GEMINI_OUTPUT_SCHEMA } from "../src/lib/gemini-contract";
import { TelemetryInteractionInsertSchema } from "../src/lib/telemetry-persistence";
import { TELEMETRY_CARE_CONTEXT_STATE_RULE } from "../src/lib/telemetry-persistence/contract-constants";
import { validateAIResponse } from "../src/lib/response-validator";
import { VERIFY_VALID_SOLENOS } from "./fixtures/solenos-valid";

console.log("=== Post-Care Insight Signal (MVP Constraint Update) ===\n");

if (!POST_CARE_INSIGHT_BOUNDARY.includes("LABEL ONLY")) {
  throw new Error("boundary must state LABEL ONLY");
}
if (!POST_CARE_INSIGHT_ONE_LINE_TRUTH.includes("measurement only")) {
  throw new Error("one-line truth drift");
}
if (POST_CARE_INSIGHT_ANTI_DRIFT_RULES.length < 3) {
  throw new Error("anti-drift rules drift");
}
for (const forbidden of POST_CARE_INSIGHT_FORBIDDEN_USES) {
  if (!forbidden) throw new Error("forbidden uses drift");
}
console.log("✓ contract constants + anti-drift rules");

const migration = fs.readFileSync("db/migrations/006_care_context_state.sql", "utf-8");
if (!migration.includes("care_context_state")) {
  throw new Error("migration must add care_context_state to interactions");
}
if (!migration.includes("'active_care'") || !migration.includes("'post_care'")) {
  throw new Error("migration must constrain care_context_state enum");
}
if (/\busers\b/i.test(migration) && /ALTER TABLE users/i.test(migration)) {
  throw new Error("care_context_state must be on interactions only");
}
console.log("✓ migration adds care_context_state to interactions only");

const telemetryConstants = fs.readFileSync(
  "src/lib/telemetry-persistence/contract-constants.ts",
  "utf-8",
);
if (!telemetryConstants.includes("TELEMETRY_CARE_CONTEXT_STATE_RULE")) {
  throw new Error("telemetry contract must document observational label rule");
}
if (!TELEMETRY_CARE_CONTEXT_STATE_RULE.includes("forbidden for user profiling")) {
  throw new Error("telemetry care_context_state rule drift");
}
console.log("✓ telemetry contract documents observational label only");

const crisisInput = classifyInputSurface("she is not breathing");
const crisis = classifyCareContextState({
  input: "she is not breathing",
  inputMode: crisisInput.mode,
  urgencyDetection: detectUrgencyLevel("she is not breathing", crisisInput.mode),
});
if (crisis.care_context_state !== "crisis") {
  throw new Error("crisis_urgent / CRITICAL must classify as crisis");
}

const postCare = classifyCareContextState({
  input: "After discharge I am not sure what to do. Care ended last week.",
  inputMode: "emotional_narrative",
  urgencyDetection: detectUrgencyLevel(
    "After discharge I am not sure what to do. Care ended last week.",
    "emotional_narrative",
  ),
});
if (postCare.care_context_state !== "post_care") {
  throw new Error("explicit post-care signals must classify as post_care");
}

const activeCare = classifyCareContextState({
  input: "I am caring for my mom and her medication schedule is confusing.",
  inputMode: "emotional_narrative",
  urgencyDetection: detectUrgencyLevel(
    "I am caring for my mom and her medication schedule is confusing.",
    "emotional_narrative",
  ),
});
if (activeCare.care_context_state !== "active_care") {
  throw new Error("ongoing care signals must classify as active_care");
}

const uncertain = classifyCareContextState({
  input: "hello",
  inputMode: "emotional_narrative",
  urgencyDetection: detectUrgencyLevel("hello", "emotional_narrative"),
});
if (uncertain.care_context_state !== "uncertain") {
  throw new Error("low-confidence input must default to uncertain");
}

const parsed = CareContextStateResultSchema.parse({ care_context_state: "post_care" });
assertClassifierOutputBoundary(parsed);
try {
  assertClassifierOutputBoundary({ care_context_state: "post_care", mode: "bad" });
  throw new Error("classifier boundary must reject extra fields");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("forbidden field")) {
    throw error;
  }
}
console.log("✓ classifier returns label only");

const profile = selectBehaviorProfile({ mode: "emotional_narrative" });
const adjusted = applyPostCareToneAdjustment(profile, "post_care");
if (adjusted.verbosity_factor >= profile.verbosity_factor) {
  throw new Error("post_care tone adjustment must reduce verbosity_factor");
}
const unchanged = applyPostCareToneAdjustment(profile, "active_care");
if (unchanged.verbosity_factor !== profile.verbosity_factor) {
  throw new Error("non-post_care must not change behavior profile");
}
console.log("✓ post_care micro tone adjustment (verbosity only)");

if (GEMINI_OUTPUT_SCHEMA.includes("care_context_state")) {
  throw new Error("output schema must NOT include care_context_state");
}
const output = validateAIResponse(VERIFY_VALID_SOLENOS);
const outputKeys = Object.keys(output).sort().join(",");
if (outputKeys !== "risk_level,what_can_wait,what_is_happening,what_matters_now,what_to_ask_next") {
  throw new Error("post_care must NOT change output schema fields");
}
console.log("✓ post_care does NOT change output schema");

const pipelineSource = fs.readFileSync(
  path.join(process.cwd(), "src/lib/analyze-pipeline/index.ts"),
  "utf-8",
);
if (!pipelineSource.includes("classifyCareContextState")) {
  throw new Error("analyze pipeline must classify care_context_state");
}
if (!pipelineSource.includes("observationTags")) {
  throw new Error("analyze pipeline must pass observation tag to envelope");
}
const forbiddenPipelinePatterns = [
  /care_context_state\s*===\s*["']post_care["'].*return/i,
  /switch\s*\(\s*careContext/i,
  /if\s*\(\s*care_context_state/i,
  /lifecycle/i,
  /stateMachine/i,
];
for (const pattern of forbiddenPipelinePatterns) {
  if (pattern.test(pipelineSource)) {
    throw new Error(`pipeline anti-drift violation: ${pattern}`);
  }
}
console.log("✓ anti-drift: pipeline uses observation tag only (no mode/lifecycle routing)");

const pageSource = fs.readFileSync("src/app/page.tsx", "utf-8");
const outputRenderer = fs.readFileSync("src/components/OutputRenderer.tsx", "utf-8");
for (const source of [pageSource, outputRenderer]) {
  if (/care_context_state|post_care|post-care/i.test(source)) {
    throw new Error("UX must not branch on care_context_state");
  }
}
console.log("✓ no UX branching in page.tsx / OutputRenderer");

assertObservationOnly({
  usesForRouting: false,
  usesForUiBranching: false,
  usesForSchemaChange: false,
  usesForLifecycle: false,
  usesForStateMachine: false,
});
try {
  assertObservationOnly({ usesForRouting: true });
  throw new Error("assertObservationOnly must reject routing");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("anti-drift")) {
    throw error;
  }
}
console.log("✓ assertObservationOnly engineering decision filter");

const observation = formatCareContextObservation("post_care");
if (!observation.startsWith("OBSERVATION: CARE_CONTEXT_STATE:")) {
  throw new Error("observation tag format drift");
}

TelemetryInteractionInsertSchema.parse({
  user_id: "00000000-0000-4000-8000-000000000001",
  input_raw: "After discharge care ended.",
  output_structured: output,
  risk_level: output.risk_level,
  latency_ms: 900,
  structure_valid: true,
  semantic_valid: true,
  input_category: "general",
  relief_outcome: "none",
  requery_detected: false,
  helpful_feedback: null,
  care_context_state: "post_care",
  caregiver_depletion_state: "normal",
  is_single_caregiver: false,
  environmental_dependency_flag: "none",
});
console.log("✓ telemetry schema accepts care_context_state");

console.log(`\n✓ ${POST_CARE_INSIGHT_BOUNDARY}`);
console.log(`✓ ${POST_CARE_INSIGHT_ONE_LINE_TRUTH}`);
