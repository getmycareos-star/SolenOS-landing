import fs from "node:fs";
import {
  CANONICAL_SYSTEM_IDENTITY,
  CANONICAL_SYSTEM_PURPOSE,
  CANONICAL_ONE_LINE_TRUTH,
  CANONICAL_POSTGRES_TRUTH,
} from "../src/lib/canonical-architecture";

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

assert(CANONICAL_SYSTEM_IDENTITY.includes("Living Care Record"), "canonical product identity must be the Living Care Record");
assert(CANONICAL_SYSTEM_PURPOSE.includes("over time"), "product purpose must describe longitudinal care continuity");
assert(CANONICAL_ONE_LINE_TRUTH.includes("evidence-linked Living Care Record"), "persistence must be a core LCR capability");
assert(CANONICAL_POSTGRES_TRUTH.includes("source of truth"), "PostgreSQL contract must identify durable care-domain authority");

const canonical = fs.readFileSync("src/lib/canonical-architecture/contract.ts", "utf8");
const postgres = fs.readFileSync("src/lib/postgres-contract/contract-constants.ts", "utf8");
const telemetry = fs.readFileSync("src/lib/telemetry-persistence/contract-constants.ts", "utf8");
const implementation = fs.readFileSync("src/lib/implementation-enforcement/contract-constants.ts", "utf8");

assert(!canonical.includes("Persistence exists to validate whether structured cognitive decomposition"), "legacy stateless persistence contract must be removed");
assert(!canonical.includes("never caregiver memory, longitudinal profiles"), "canonical Postgres contract must not prohibit LCR persistence");
assert(postgres.includes("backend PostgreSQL care-domain schema is authoritative"), "telemetry Postgres contract must be explicitly scoped");
assert(telemetry.includes("separate from authoritative care-domain persistence"), "telemetry must remain separate from care-record authority");
assert(implementation.includes("Living Care Record"), "implementation enforcement identity must match product identity");

const backendProjection = fs.readFileSync("../SolenOS_backend/backend/app/services/lcr_context.py", "utf8");
const caregiverProjection = fs.readFileSync("src/components/mvp-workspace/LCRCurrentUnderstanding.tsx", "utf8");
assert(backendProjection.includes('"evidence"') && backendProjection.includes('"assertions"'), "backend LCR projection must include evidence and assertions");
assert(caregiverProjection.includes("CurrentCareItem") && caregiverProjection.includes("epistemic_status"), "caregiver projection must preserve epistemic status");

console.log("PASS: SolenOS canonical product identity is the Living Care Record.");
console.log("PASS: telemetry is separated from authoritative care-domain persistence.");
console.log("PASS: backend and caregiver LCR projection anchors remain present.");
console.log("NOTE: static contract test only; not an end-to-end PostgreSQL execution test.");
