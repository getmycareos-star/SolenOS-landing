import fs from "node:fs";
import path from "node:path";
import {
  ARCHITECTURE_GUARDRAIL_QUESTION,
  CASE_SCOPED_MEMORY_RULE,
  DOMAIN_BOUNDARIES,
  DOMAIN_MODULE_MAP,
  DOMAIN_MODULES,
  FORBIDDEN_ARCHITECTURES,
  MODULAR_MONOLITH_PRINCIPLE,
  SYSTEM_EVENT_TYPES,
  passesArchitectureGuardrail,
} from "../src/lib/system-architecture";
import {
  CaseStateSchema,
  CurrentCareStateSchema,
  MemoryStateSchema,
  RiskStateSchema,
  UserContextStateSchema,
} from "../src/lib/system-architecture/state-models";

console.log("=== SolenOS — SYSTEM ARCHITECTURE CONTRACT (MVP Foundation) ===\n");

if (!MODULAR_MONOLITH_PRINCIPLE.includes("monolith")) {
  throw new Error("modular monolith principle must be defined");
}
console.log(`✓ ${MODULAR_MONOLITH_PRINCIPLE}`);

if (DOMAIN_MODULE_MAP.length !== 8) {
  throw new Error(`expected 8 domain module mappings, found ${DOMAIN_MODULE_MAP.length}`);
}
for (const module of DOMAIN_MODULES) {
  if (!DOMAIN_MODULE_MAP.some((m) => m.module === module)) {
    throw new Error(`missing module map entry for ${module}`);
  }
}
console.log("✓ modular monolith map: 8 domain modules");

if (DOMAIN_BOUNDARIES.length !== 8) {
  throw new Error(`expected 8 domain boundaries, found ${DOMAIN_BOUNDARIES.length}`);
}
for (const boundary of DOMAIN_BOUNDARIES) {
  if (boundary.owns.length === 0 || boundary.forbidden.length === 0) {
    throw new Error(`domain ${boundary.module} must define owns and forbidden concerns`);
  }
}
console.log("✓ 8 domain boundaries with ownership + forbidden cross-module concerns");

const expectedEvents = [
  "document_uploaded",
  "document_processed",
  "interaction_created",
  "risk_detected",
  "decision_generated",
  "case_updated",
  "notification_sent",
];
if (SYSTEM_EVENT_TYPES.join(",") !== expectedEvents.join(",")) {
  throw new Error("system event types must match architecture spec");
}
const eventsSource = fs.readFileSync("src/lib/system-architecture/events.ts", "utf-8");
if (!eventsSource.includes("SystemEventRecordSchema")) {
  throw new Error("events.ts must define append-only SystemEventRecordSchema");
}
console.log(`✓ ${SYSTEM_EVENT_TYPES.length} append-only event types`);

for (const schema of [
  CaseStateSchema,
  RiskStateSchema,
  MemoryStateSchema,
  CurrentCareStateSchema,
  UserContextStateSchema,
]) {
  if (!schema || typeof schema.parse !== "function") {
    throw new Error("state model schemas must be defined and parseable");
  }
}
console.log("✓ explicit state models: CurrentCareState, RiskState, MemoryState, CaseState, UserContextState");

const architectureSources = [
  "src/lib/system-architecture/contract-constants.ts",
  "src/lib/system-architecture/domain-boundaries.ts",
  "src/lib/system-architecture/module-map.ts",
  "src/lib/system-architecture/index.ts",
].map((f) => fs.readFileSync(f, "utf-8"));

for (const forbidden of FORBIDDEN_ARCHITECTURES) {
  for (const source of architectureSources) {
    if (source.toLowerCase().includes(`use ${forbidden}`)) {
      throw new Error(`architecture must not advocate forbidden pattern: ${forbidden}`);
    }
  }
}
const repoScanDirs = ["src/lib/domains"];
for (const dir of repoScanDirs) {
  const files = fs.readdirSync(dir, { recursive: true }) as string[];
  for (const file of files) {
    if (!file.endsWith(".ts")) continue;
    const content = fs.readFileSync(path.join(dir, file), "utf-8").toLowerCase();
    if (
      content.includes("microservice architecture") ||
      content.includes("use microservices") ||
      content.includes("service mesh deployment")
    ) {
      throw new Error(`forbidden microservice reference in ${path.join(dir, file)}`);
    }
  }
}
const contractConstants = fs.readFileSync(
  "src/lib/system-architecture/contract-constants.ts",
  "utf-8",
);
for (const forbidden of FORBIDDEN_ARCHITECTURES) {
  if (!contractConstants.includes(forbidden)) {
    throw new Error(`FORBIDDEN_ARCHITECTURES must list: ${forbidden}`);
  }
}
console.log("✓ no microservice/service-mesh architecture references");

const guardrailPass = passesArchitectureGuardrail({ reducesCaregiverCognitiveLoad: true });
const guardrailFail = passesArchitectureGuardrail({ reducesCaregiverCognitiveLoad: false });
if (!guardrailPass.passes || guardrailFail.passes) {
  throw new Error("passesArchitectureGuardrail must gate on reducesCaregiverCognitiveLoad");
}
if (guardrailPass.question !== ARCHITECTURE_GUARDRAIL_QUESTION) {
  throw new Error("guardrail question must match contract");
}
console.log(`✓ guardrail: ${ARCHITECTURE_GUARDRAIL_QUESTION}`);

const memoryDomain = fs.readFileSync("src/lib/domains/memory/index.ts", "utf-8");
if (!memoryDomain.includes("CASE_SCOPED_MEMORY_RULE") || !memoryDomain.includes("MEMORY_CASE_SCOPED_RULE")) {
  throw new Error("memory domain must document case-scoped memory rule");
}
if (!memoryDomain.includes("does NOT generate conclusions")) {
  throw new Error("memory domain must document no-conclusion contract");
}
console.log(`✓ case-scoped memory rule: ${CASE_SCOPED_MEMORY_RULE.slice(0, 60)}...`);

const telemetryDomain = fs.readFileSync("src/lib/domains/telemetry/index.ts", "utf-8");
const decisionDomain = fs.readFileSync("src/lib/domains/decision/index.ts", "utf-8");
const notificationDomain = fs.readFileSync("src/lib/domains/notification/index.ts", "utf-8");

if (telemetryDomain.includes("analyze-pipeline") || telemetryDomain.includes("runAnalyzePipeline")) {
  throw new Error("telemetry domain must not import decision generation");
}
if (decisionDomain.includes("support-signal-system") || decisionDomain.includes("evaluateSupportSignal")) {
  throw new Error("decision domain must not import notification generation");
}
if (notificationDomain.includes("analyze-pipeline") || notificationDomain.includes("runAnalyzePipeline")) {
  throw new Error("notification domain must not import decision generation");
}
console.log("✓ domain import boundaries: telemetry/decision/notification isolated");

const emitSource = fs.readFileSync("src/lib/system-architecture/emit-event.ts", "utf-8");
if (!emitSource.includes("emitSystemEvent")) {
  throw new Error("emit-event.ts must export emitSystemEvent");
}
if (!emitSource.includes("non-blocking")) {
  throw new Error("emitSystemEvent must be documented as non-blocking");
}

const analyzeRoute = fs.readFileSync("src/app/api/analyze/route.ts", "utf-8");
if (!analyzeRoute.includes("emitSystemEvent")) {
  throw new Error("analyze route must emit system events");
}
if (!analyzeRoute.includes("interaction_created") || !analyzeRoute.includes("decision_generated")) {
  throw new Error("analyze route must emit interaction_created and decision_generated");
}
console.log("✓ event emission wired in analyze route");

const pipelineSource = fs.readFileSync("src/lib/analyze-pipeline/index.ts", "utf-8");
if (!pipelineSource.includes("FAILURE ISOLATION") || !pipelineSource.includes("async OCR")) {
  throw new Error("analyze pipeline must document failure isolation from async document OCR");
}
console.log("✓ failure isolation: analyze does not depend on document OCR completion");

const migration009 = fs.readFileSync("db/migrations/009_system_architecture_foundation.sql", "utf-8");
if (!migration009.includes("CREATE TABLE IF NOT EXISTS cases")) {
  throw new Error("009 migration must create cases table");
}
if (!migration009.includes("CREATE TABLE IF NOT EXISTS system_events")) {
  throw new Error("009 migration must create system_events table");
}
if (migration009.includes("CREATE EXTENSION IF NOT EXISTS vector")) {
  throw new Error("009 migration must NOT require pgvector");
}
console.log("✓ 009 migration: cases + append-only system_events (no pgvector)");

const canonical = fs.readFileSync("src/lib/canonical-architecture/contract.ts", "utf-8");
if (!canonical.includes("CANONICAL_MODULAR_MONOLITH_TRUTH")) {
  throw new Error("canonical contract must include CANONICAL_MODULAR_MONOLITH_TRUTH");
}
console.log("✓ CANONICAL_MODULAR_MONOLITH_TRUTH in canonical contract");

console.log("\n✓ SolenOS system architecture MVP foundation satisfied");
