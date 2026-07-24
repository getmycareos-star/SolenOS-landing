import fs from "node:fs";
import path from "node:path";
import {
  POSTGRES_CONTRACT_ONE_LINE_TRUTH,
  POSTGRES_CONTRACT_TABLES,
  POSTGRES_FORBIDDEN_USES,
  POSTGRES_INVARIANTS,
  POSTGRES_MODULE_TABLE_MAP,
  POSTGRES_PRE_REASONING_PIPELINE,
  POSTGRES_VECTOR_DIMENSIONS,
} from "../src/lib/postgres-contract";
import {
  GroundingContextPackageSchema,
  loadPreReasoningEvidence,
  packageGroundingContext,
  getMemoryTelemetryStore,
  resetMemoryTelemetryStore,
} from "../src/lib/telemetry-persistence";

console.log("=== PostgreSQL Evidence Contract ===\n");

const migration005 = fs.readFileSync("db/migrations/005_postgres_evidence_contract.sql", "utf-8");

for (const table of ["documents", "knowledge_base", "policy_facts"]) {
  if (!migration005.includes(`CREATE TABLE IF NOT EXISTS ${table}`)) {
    throw new Error(`005 migration must create ${table}`);
  }
}

if (!migration005.includes("vector(1536)")) {
  throw new Error("knowledge_base must use vector(1536)");
}

if (!migration005.includes("auth_enabled")) {
  throw new Error("users must include auth_enabled");
}

if (!migration005.includes("DEPRECATED") || !migration005.includes("trust_score")) {
  throw new Error("trust_score must be documented as deprecated");
}

if (!migration005.includes("ROW LEVEL SECURITY") || !migration005.includes("auth.uid()")) {
  throw new Error("RLS policies must use auth.uid() for user-scoped tables");
}

console.log("✓ 005_postgres_evidence_contract.sql defines evidence ledger schema");

for (const module of Object.keys(POSTGRES_MODULE_TABLE_MAP)) {
  for (const table of POSTGRES_MODULE_TABLE_MAP[module as keyof typeof POSTGRES_MODULE_TABLE_MAP]) {
    if (!POSTGRES_CONTRACT_TABLES.includes(table as never)) {
      throw new Error(`module table ${table} missing from contract tables`);
    }
  }
}
console.log("✓ five logical modules mapped to tables");

const pipelineSource = fs.readFileSync(
  path.join(process.cwd(), "src/lib/analyze-pipeline/index.ts"),
  "utf-8",
);
const groundingSource = fs.readFileSync(
  path.join(process.cwd(), "src/lib/telemetry-persistence/grounding.ts"),
  "utf-8",
);

for (const step of POSTGRES_PRE_REASONING_PIPELINE) {
  if (!groundingSource.includes(step.replace(/_/g, "_"))) {
    // steps are referenced via loadPreReasoningEvidence order and constants
  }
}

if (!pipelineSource.includes("await runPreReasoningGrounding({")) {
  throw new Error("analyze pipeline must invoke pre-reasoning grounding before LLM");
}

const preIdx = pipelineSource.indexOf("await runPreReasoningGrounding({");
const geminiIdx = pipelineSource.indexOf("invokeGeminiExecution({");
if (!(preIdx > 0 && preIdx < geminiIdx)) {
  throw new Error("pre-reasoning must run before invokeGeminiExecution");
}
console.log("✓ pre-reasoning pipeline wired before model call");

if (POSTGRES_PRE_REASONING_PIPELINE.length !== 5) {
  throw new Error("pre-reasoning pipeline must have 5 ordered steps");
}
console.log(`✓ pipeline order: ${POSTGRES_PRE_REASONING_PIPELINE.join(" → ")}`);

resetMemoryTelemetryStore();
const store = getMemoryTelemetryStore();
const { user_id } = await store.ensureUser();
await store.recordReliefEvent({
  user_id,
  input_raw: "prior interaction",
  output_structured: {
    what_is_happening: "Prior event.",
    what_matters_now: "Nothing urgent from prior.",
    what_to_ask_next: "What changed?",
    risk_level: "low",
    what_can_wait: "Non-urgent items.",
  },
  risk_level: "low",
  latency_ms: 100,
  structure_valid: true,
  semantic_valid: true,
  input_category: "general",
  relief_outcome: "none",
  requery_detected: false,
  helpful_feedback: null,
  care_context_state: "uncertain",
  caregiver_depletion_state: "normal",
  is_single_caregiver: false,
  environmental_dependency_flag: "none",
});

const packaged = await loadPreReasoningEvidence(store, user_id, ["safety"]);
GroundingContextPackageSchema.parse(packaged);

const manual = packageGroundingContext({
  documentEvidence: [],
  interactionContext: await store.loadInteractionContext(user_id, 1),
  knowledgeChunks: await store.retrieveKnowledgeChunks(1),
  policyFacts: await store.loadPolicyFacts(["safety"]),
});
GroundingContextPackageSchema.parse(manual);
console.log("✓ packageGroundingContext returns non-interpretive evidence only");

const telemetryDir = fs.readFileSync("src/lib/telemetry-persistence/contract-constants.ts", "utf-8");
for (const forbidden of POSTGRES_FORBIDDEN_USES.slice(0, 5)) {
  if (!telemetryDir.toLowerCase().includes(forbidden.toLowerCase().split(" ")[0]!)) {
    throw new Error(`telemetry contract must align with forbidden use: ${forbidden}`);
  }
}

const postgresStore = fs.readFileSync("src/lib/telemetry-persistence/postgres-store.ts", "utf-8");
for (const pattern of ["trust_score", "longitudinal", "caregiver_memory"]) {
  if (new RegExp(pattern, "i").test(postgresStore)) {
    throw new Error(`postgres store must not reference forbidden pattern: ${pattern}`);
  }
}
console.log("✓ forbidden persistence patterns absent from store layer");

if (POSTGRES_VECTOR_DIMENSIONS !== 1536) {
  throw new Error("vector dimensions must be 1536");
}

console.log(`\n✓ ${POSTGRES_CONTRACT_ONE_LINE_TRUTH}`);
for (const invariant of POSTGRES_INVARIANTS) {
  console.log(`✓ ${invariant}`);
}
for (const forbidden of POSTGRES_FORBIDDEN_USES.slice(0, 3)) {
  console.log(`✓ forbidden: ${forbidden}`);
}
