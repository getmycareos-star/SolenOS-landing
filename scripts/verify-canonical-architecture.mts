import fs from "node:fs";
import {
  CANONICAL_ARCHITECTURE_FLOW,
  CANONICAL_CORE_PRINCIPLE,
  CANONICAL_DISPLAY_SECTIONS,
  CANONICAL_FORBIDDEN_IDENTITY,
  CANONICAL_FORBIDDEN_OPERATIONS,
  CANONICAL_META_FIELD_ORDER,
  CANONICAL_ONE_LINE_TRUTH,
  CANONICAL_OUTPUT_FIELD_ORDER,
  CANONICAL_PRIMARY_FAILURE_MODEL,
  CANONICAL_SYSTEM_IDENTITY,
  CANONICAL_VALIDATION_PIPELINE,
} from "../src/lib/canonical-architecture";
import {
  SOLENOS_FIELD_ORDER,
  META_FIELD_ORDER,
} from "../src/lib/consistency-determinism/types";
import {
  MVP_FLOW,
  MVP_VALIDATION_PIPELINE,
} from "../src/lib/mvp-architecture";
import {
  SOLENOS_SCHEMA_FIELD_NAMES,
  SOLENOS_SYSTEM_PROMPT,
} from "../src/lib/solenos-langchain-adapter/system-prompt";
import { GEMINI_OUTPUT_SCHEMA } from "../src/lib/gemini-contract";

console.log("=== SolenOS — CANONICAL SYSTEM IDENTITY CONTRACT ===\n");

if (CANONICAL_OUTPUT_FIELD_ORDER.join(",") !== SOLENOS_FIELD_ORDER.join(",")) {
  throw new Error("output field order must match canonical contract");
}
if (CANONICAL_META_FIELD_ORDER.join(",") !== META_FIELD_ORDER.join(",")) {
  throw new Error("_meta field order must match canonical contract");
}
if (SOLENOS_SCHEMA_FIELD_NAMES.join(",") !== CANONICAL_OUTPUT_FIELD_ORDER.join(",")) {
  throw new Error("system prompt schema fields must match canonical order");
}
console.log("✓ immutable output schema field order");

if (!SOLENOS_SYSTEM_PROMPT.includes("cognitive decomposition engine")) {
  throw new Error("system prompt missing canonical system identity");
}
if (!SOLENOS_SYSTEM_PROMPT.includes(CANONICAL_CORE_PRINCIPLE.split(".")[0]!)) {
  throw new Error("system prompt missing core principle");
}
if (!SOLENOS_SYSTEM_PROMPT.includes("HARD FAIL CONDITIONS")) {
  throw new Error("system prompt missing primary failure model");
}
if (!SOLENOS_SYSTEM_PROMPT.includes("TELEMETRY BOUNDARY")) {
  throw new Error("system prompt missing telemetry measurement-only boundary");
}
console.log("✓ system identity + failure model + telemetry boundary in prompt");

for (const forbidden of CANONICAL_FORBIDDEN_IDENTITY.slice(0, 4)) {
  if (SOLENOS_SYSTEM_PROMPT.toLowerCase().includes(`you are ${forbidden}`)) {
    throw new Error(`prompt must not claim forbidden identity: ${forbidden}`);
  }
}
console.log("✓ forbidden identity boundaries preserved");

if (CANONICAL_DISPLAY_SECTIONS.length !== 6) {
  throw new Error("display sections must include all 6 fixed output sections");
}
console.log("✓ 6-section fixed output model");

if (GEMINI_OUTPUT_SCHEMA.includes("_meta") || GEMINI_OUTPUT_SCHEMA.includes("emotional_context")) {
  throw new Error("gemini schema must not include removed fields");
}
if (!GEMINI_OUTPUT_SCHEMA.includes('"low" | "medium" | "high" | "critical"')) {
  throw new Error("gemini schema must use low|medium|high|critical risk levels");
}
console.log("✓ gemini envelope aligned to 6-field schema");

if (MVP_VALIDATION_PIPELINE.join("|") !== CANONICAL_VALIDATION_PIPELINE.join("|")) {
  throw new Error("MVP validation pipeline must match canonical pipeline");
}
if (MVP_FLOW.length !== CANONICAL_ARCHITECTURE_FLOW.length) {
  throw new Error("MVP architecture flow length must match canonical flow");
}
console.log("✓ MVP boundary imports canonical pipeline + flow");

const pipeline = fs.readFileSync("src/lib/analyze-pipeline/index.ts", "utf-8");
if (!pipeline.includes("if (!isGroundingValid(structural.data")) {
  throw new Error("analyze pipeline must include grounding validation");
}
if (!pipeline.includes("if (!isUrgencyEscalationValid(structural.data")) {
  throw new Error("analyze pipeline must include urgency escalation validation");
}
if (!pipeline.includes("if (!isSemanticRoleIsolationValid(structural.data")) {
  throw new Error("analyze pipeline must include semantic role isolation validation");
}
if (!pipeline.includes("if (!isEpisodicReliefValid(epistemicOutput")) {
  throw new Error("analyze pipeline must include episodic relief validation");
}
if (!pipeline.includes("if (!isNonConversationalValid(epistemicOutput")) {
  throw new Error("analyze pipeline must include non-conversational validation");
}
if (!pipeline.includes("if (!isUnknownStateValid(structural.data")) {
  throw new Error("analyze pipeline must include unknown-state verification");
}
if (!pipeline.includes("applyDocumentIntake")) {
  throw new Error("analyze pipeline must apply document intake");
}
if (!pipeline.includes("if (!isDocumentIntakeValid(structural.data")) {
  throw new Error("analyze pipeline must include document intake validation");
}
console.log("✓ document intake wired in pipeline");

const epistemic = fs.readFileSync("src/lib/epistemic-safety-engine/index.ts", "utf-8");
if (!epistemic.includes("enforceEpistemicSafety")) {
  throw new Error("epistemic safety engine must be present");
}
console.log("✓ epistemic safety layer present");

for (const phrase of ["invent missing facts", "merge interpretations", "assume hidden meaning"]) {
  if (!SOLENOS_SYSTEM_PROMPT.toLowerCase().includes(phrase.toLowerCase())) {
    throw new Error(`prompt must forbid operation: ${phrase}`);
  }
}
console.log("✓ forbidden operations listed in prompt");

console.log(`\n✓ ${CANONICAL_ONE_LINE_TRUTH}`);
console.log(`✓ ${CANONICAL_PRIMARY_FAILURE_MODEL}`);
