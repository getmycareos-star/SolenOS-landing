import { stressNormalizeInput } from "../src/lib/input-stress-normalizer";
import {
  applyDocumentIntake,
  DocumentClarityOutputSchema,
  DOCUMENT_CLARITY_FIELD_ORDER,
  validateDocumentIntakeCompliance,
  CANONICAL_DOCUMENT_PIPELINE,
} from "../src/lib/document-intake";
import { validateAIResponse } from "../src/lib/response-validator";
import {
  classifyDocumentIntakeFailure,
  FailureLogEntrySchema,
} from "../src/lib/failure-observability";
import { SOLENOS_SYSTEM_PROMPT } from "../src/lib/solenos-langchain-adapter/system-prompt";
import { VERIFY_VALID_SOLENOS } from "./fixtures/solenos-valid";

console.log("=== SolenOS — UNIVERSAL DOCUMENT INTAKE CONTRACT ===\n");

if (!SOLENOS_SYSTEM_PROMPT.includes("DOCUMENT PROCESSING")) {
  throw new Error("system prompt must define document processing rule");
}
if (!SOLENOS_SYSTEM_PROMPT.includes("unstructured human reality")) {
  throw new Error("system prompt must treat documents as unstructured human reality");
}
console.log("✓ document processing rule in system prompt");

if (CANONICAL_DOCUMENT_PIPELINE.length !== 10) {
  throw new Error("universal document pipeline must have 10 stages");
}
console.log("✓ 10-stage universal document pipeline defined");

DocumentClarityOutputSchema.parse({
  document_types: [],
  key_facts: [],
  action_items: [],
  deadlines: [],
  entities: [],
  uncertainties: [],
  risk_flags: [],
});
if (DOCUMENT_CLARITY_FIELD_ORDER.join(",") !== "document_types,key_facts,action_items,deadlines,entities,uncertainties,risk_flags") {
  throw new Error("document clarity field order mismatch");
}
console.log("✓ canonical DocumentClarityOutput schema");

const insuranceInput = stressNormalizeInput(
  "Uploaded insurance letter: Prior authorization required by March 15. Policy number 12345. Coverage decision pending.",
);
const intake = applyDocumentIntake(insuranceInput);
if (!intake.is_document_input) throw new Error("insurance letter must be document input");
if (!intake.document_type_tags.includes("INSURANCE_DOCUMENT")) {
  throw new Error("must tag INSURANCE_DOCUMENT");
}
console.log("✓ document type tagging (organizational only)");

const groundedDoc = validateAIResponse({
  ...VERIFY_VALID_SOLENOS,
  what_is_happening:
    "The document states prior authorization is required by March 15 and lists policy number 12345 with coverage decision pending.",
});
const pass = validateDocumentIntakeCompliance(groundedDoc, intake);
if (!pass.valid) throw new Error(`grounded doc output must pass: ${pass.violations.join(",")}`);
console.log("✓ grounded document output passes compliance");

const authority = validateDocumentIntakeCompliance(
  {
    ...groundedDoc,
    what_matters_now: "You are eligible for coverage and the claim is approved for this treatment.",
  },
  intake,
);
if (authority.valid) throw new Error("domain authority interpretation must fail");
console.log("✓ blocks insurance eligibility interpretation");

const multiInput = stressNormalizeInput(
  "Document 1: Pay by Jan 1.\n---\nDocument 2: Do not pay until Feb 1.",
);
const multiIntake = applyDocumentIntake(multiInput);
if (multiIntake.document_count < 2) throw new Error("multi-document boundaries must be detected");

const reconciled = validateDocumentIntakeCompliance(
  {
    ...groundedDoc,
    what_is_happening: "The correct document actually shows Jan 1 and the contradiction is resolved.",
  },
  multiIntake,
);
if (reconciled.valid) throw new Error("document reconciliation must fail");
console.log("✓ preserves multi-document boundaries and contradictions");

FailureLogEntrySchema.parse({
  timestamp: new Date().toISOString(),
  stage: "postprocess",
  failure_type: classifyDocumentIntakeFailure().failure_type,
  retry_count: 0,
});
console.log("✓ DOCUMENT_INTAKE_FAILURE logged via observability");

console.log("\n✓ universal document intake + structured clarity contract enforced");
