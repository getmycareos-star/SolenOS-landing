import {
  CANONICAL_ARCHITECTURE_FLOW,
  CANONICAL_CORE_PRINCIPLE,
  CANONICAL_DISPLAY_SECTIONS,
  CANONICAL_FORBIDDEN_IDENTITIES,
  CANONICAL_ONE_LINE_TRUTH,
  CANONICAL_POSTGRES_TRUTH,
  CANONICAL_PRIMARY_FAILURE_MODEL,
  CANONICAL_PRODUCT_MOAT,
  CANONICAL_RISK_LEVELS,
  CANONICAL_SYSTEM_IDENTITY,
  CANONICAL_SYSTEM_PURPOSE,
  CANONICAL_VALIDATION_PIPELINE,
} from "../src/lib/canonical-architecture";
import { verifyUnknownState, isUnknownStateValid } from "../src/lib/unknown-state-verification";
import { validateAIResponse } from "../src/lib/response-validator";
import {
  classifyUnknownStateFailure,
  FailureLogEntrySchema,
} from "../src/lib/failure-observability";
import { VERIFY_VALID_SOLENOS } from "./fixtures/solenos-valid";

console.log("=== SolenOS — Living Care Record system identity ===\\n");

if (!CANONICAL_SYSTEM_IDENTITY.includes("Living Care Record")) {
  throw new Error("canonical system identity must be the Living Care Record");
}
if (!CANONICAL_SYSTEM_PURPOSE.includes("care continuity over time")) {
  throw new Error("canonical system purpose must preserve care continuity over time");
}
if (!CANONICAL_ONE_LINE_TRUTH.includes("only governed, attributable care-domain operations")) {
  throw new Error("accepted care-record changes must remain governed and attributable");
}
if (!CANONICAL_POSTGRES_TRUTH.includes("Production PostgreSQL is the durable source of truth")) {
  throw new Error("PostgreSQL must remain the durable care-record source of truth");
}
if (!CANONICAL_PRIMARY_FAILURE_MODEL.includes("unreviewed model output")) {
  throw new Error("unreviewed model output must never become authoritative care state");
}
if (!CANONICAL_CORE_PRINCIPLE.includes("Every care statement retains its source, actor, time context")) {
  throw new Error("care statements must preserve source, actor and time context");
}
if (!CANONICAL_FORBIDDEN_IDENTITIES.includes("chatbot")) {
  throw new Error("SolenOS must not be defined as a chatbot");
}
if (!CANONICAL_ARCHITECTURE_FLOW.some((step) => step.includes("Qwen extraction"))) {
  throw new Error("canonical AI flow must identify evidence-grounded Qwen extraction");
}
if (CANONICAL_ARCHITECTURE_FLOW.some((step) => step.includes("Gemini"))) {
  throw new Error("retired Gemini inference must not remain in the canonical AI flow");
}
console.log("✓ LCR identity, PostgreSQL authority, review boundary and Qwen extraction");

if (CANONICAL_RISK_LEVELS.length !== 4 || !CANONICAL_RISK_LEVELS.includes("critical")) {
  throw new Error("canonical risk levels must include critical");
}
console.log(`✓ canonical product moat: ${CANONICAL_PRODUCT_MOAT}`);

if (CANONICAL_DISPLAY_SECTIONS.length !== 6) {
  throw new Error("current canonical display contract must contain six sections");
}
console.log("✓ six-section canonical display contract");

if (CANONICAL_VALIDATION_PIPELINE[0] !== "JSON schema validation") {
  throw new Error("validation pipeline must start with schema validation");
}
console.log("✓ mandatory validation pipeline order");

const grounded = validateAIResponse(VERIFY_VALID_SOLENOS);
if (!isUnknownStateValid(grounded)) {
  throw new Error(`valid fixture must pass unknown-state: ${verifyUnknownState(grounded).violations.join(",")}`);
}
console.log("✓ unknown-state verification accepts valid fixture");

FailureLogEntrySchema.parse({
  timestamp: new Date().toISOString(),
  stage: "postprocess",
  failure_type: classifyUnknownStateFailure().failure_type,
  retry_count: 0,
});
console.log("✓ UNKNOWN_STATE_FAILURE logged via observability");

console.log(`\\n✓ ${CANONICAL_SYSTEM_PURPOSE}`);
console.log(`✓ ${CANONICAL_ONE_LINE_TRUTH}`);
