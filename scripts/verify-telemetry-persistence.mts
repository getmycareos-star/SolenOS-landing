import fs from "node:fs";

import {

  assertFeedbackSchemaBoundary,

  assertInteractionSchemaBoundary,

  assertUserSchemaBoundary,

  TELEMETRY_ALLOWED_TABLES,

  TELEMETRY_DRIFT_PREVENTION_RULE,

  TELEMETRY_EVENT_MODEL,

  TELEMETRY_FORBIDDEN_IN_API,

  TELEMETRY_ONE_LINE_TRUTH,

  TELEMETRY_POSTGRES_ROLE,

  TELEMETRY_USER_FORBIDDEN_FIELDS,

  getMemoryTelemetryStore,

  resetMemoryTelemetryStore,

  TelemetryFeedbackSubmitSchema,

  TelemetryInteractionInsertSchema,

} from "../src/lib/telemetry-persistence";

import { VERIFY_VALID_SOLENOS } from "./fixtures/solenos-valid";



console.log("=== Telemetry Persistence — Relief Validation Storage ===\n");



const migration = fs.readFileSync("db/migrations/001_telemetry_schema.sql", "utf-8");

const reliefMigration = fs.readFileSync("db/migrations/002_relief_validation.sql", "utf-8");
const evidenceMigration = fs.readFileSync("db/migrations/005_postgres_evidence_contract.sql", "utf-8");
const careContextMigration = fs.readFileSync("db/migrations/006_care_context_state.sql", "utf-8");
const depletionMigration = fs.readFileSync("db/migrations/007_caregiver_depletion_signals.sql", "utf-8");
const allMigrationSql = [migration, reliefMigration, evidenceMigration, careContextMigration, depletionMigration].join("\n");

for (const forbidden of TELEMETRY_USER_FORBIDDEN_FIELDS) {

  if (new RegExp(`\\b${forbidden}\\b`, "i").test(migration)) {

    throw new Error(`migration must not define forbidden user field: ${forbidden}`);

  }

}

for (const table of TELEMETRY_ALLOWED_TABLES) {

  if (!allMigrationSql.includes(`CREATE TABLE IF NOT EXISTS ${table}`)) {

    throw new Error(`migration must define telemetry table: ${table}`);

  }

}

if (!reliefMigration.includes("relief_outcome") || !reliefMigration.includes("requery_detected")) {

  throw new Error("relief validation migration must define interaction-bound relief fields");

}

if (!careContextMigration.includes("care_context_state")) {

  throw new Error("care context migration must define interactions.care_context_state");

}

if (!depletionMigration.includes("caregiver_depletion_state")) {

  throw new Error("depletion migration must define interactions.caregiver_depletion_state");

}

console.log("✓ strict postgres schema — evidence ledger tables only");



assertUserSchemaBoundary([
  "id",
  "created_at",
  "last_seen_at",
  "total_sessions",
  "auth_enabled",
  "email",
  "password_hash",
  "trust_score",
]);

assertInteractionSchemaBoundary([

  "user_id",

  "input_raw",

  "output_structured",

  "risk_level",

  "latency_ms",

  "structure_valid",

  "semantic_valid",

  "input_category",

  "relief_outcome",

  "requery_detected",

  "helpful_feedback",

  "relief_signal",

  "helpful_yes_no",

  "reduced_confusion_yes_no",

  "care_context_state",

  "caregiver_depletion_state",

  "is_single_caregiver",

  "environmental_dependency_flag",

]);

assertFeedbackSchemaBoundary(["interaction_id", "helpful_yes_no", "reduced_confusion_yes_no"]);

console.log("✓ schema boundary rejects drift columns");



resetMemoryTelemetryStore();

const store = getMemoryTelemetryStore();

const { user_id } = await store.ensureUser();

const output = VERIFY_VALID_SOLENOS;

const event = TelemetryInteractionInsertSchema.parse({

  user_id,

  input_raw: "Mom missed her evening medication.",

  output_structured: output,

  risk_level: output.risk_level,

  latency_ms: 1200,

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

const recorded = await store.recordReliefEvent(event);

if (!recorded.interaction_id) {

  throw new Error("relief event must return interaction_id");

}

console.log("✓ relief validation event recorded");



const feedback = TelemetryFeedbackSubmitSchema.parse({

  interaction_id: recorded.interaction_id,

  helpful_yes_no: true,

  reduced_confusion_yes_no: true,

});

await store.recordFeedback(feedback);

TelemetryFeedbackSubmitSchema.parse({
  interaction_id: recorded.interaction_id,
  helpful_yes_no: true,
  reduced_confusion_yes_no: false,
  care_key: "cg_telemetry_containment",
});

console.log("✓ feedback schema accepts optional care_key for load/containment");



const interaction = store.peekInteractions()[0];

if (interaction?.helpful_feedback !== true) {

  throw new Error("helpful feedback must bind to interaction record");

}

if (interaction?.relief_outcome !== "high") {

  throw new Error(`positive feedback must classify high relief, got ${interaction?.relief_outcome}`);

}

console.log("✓ interaction-bound feedback updates relief_outcome");



const analyzeRoute = fs.readFileSync("src/app/api/analyze/route.ts", "utf-8");

const feedbackRoute = fs.readFileSync("src/app/api/feedback/route.ts", "utf-8");

if (!analyzeRoute.includes("recordReliefMeasurementEvent")) {

  throw new Error("/api/analyze must record relief validation events");

}

if (!feedbackRoute.includes("TelemetryFeedbackSubmitSchema")) {

  throw new Error("/api/feedback must use telemetry feedback schema");

}

for (const forbidden of TELEMETRY_FORBIDDEN_IN_API) {

  if (feedbackRoute.toLowerCase().includes(forbidden.toLowerCase())) {

    throw new Error(`/api/feedback contains forbidden telemetry drift pattern: ${forbidden}`);

  }

}

const serverSource = fs.readFileSync("src/lib/telemetry-persistence/server.ts", "utf-8");
const validationUi = fs.readFileSync("src/components/HumanValidationLoop.tsx", "utf-8");

if (!serverSource.includes("setFeedbackContainmentFromFeedback")) {
  throw new Error("recordReliefFeedback must set feedback containment when care_key present");
}

if (!validationUi.includes("care_key")) {
  throw new Error("validation loop must pass optional care_key for load/containment");
}

for (const forbidden of ["dashboard", "engagement score", "feedback score", "trust score"]) {
  if (validationUi.toLowerCase().includes(forbidden.toLowerCase())) {
    throw new Error(`validation UI must not expose telemetry product surface: ${forbidden}`);
  }
}

console.log("✓ feedback API + validation UI — telemetry non-blocking; load/containment only");



console.log(`\n✓ ${TELEMETRY_POSTGRES_ROLE}`);

console.log(`✓ ${TELEMETRY_EVENT_MODEL}`);

console.log(`✓ ${TELEMETRY_DRIFT_PREVENTION_RULE}`);

console.log(`✓ ${TELEMETRY_ONE_LINE_TRUTH}`);


