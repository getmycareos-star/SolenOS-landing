import {
  SEMANTIC_ROLE_CORE_RULE,
  SEMANTIC_ROLE_FAILURE_MODEL,
  SEMANTIC_ROLE_ONE_LINE_TRUTH,
  isSemanticRoleIsolationValid,
  validateSemanticRoleIsolation,
} from "../src/lib/semantic-role-isolation";
import { classifySemanticRoleIsolationFailure, FailureLogEntrySchema } from "../src/lib/failure-observability";
import { SOLENOS_SYSTEM_PROMPT, SYSTEM_PROMPT_SPEC_MARKERS } from "../src/lib/solenos-langchain-adapter/system-prompt";
import { validateAIResponse } from "../src/lib/response-validator";
import { VERIFY_SEMANTIC_ROLE_EXAMPLE, VERIFY_VALID_SOLENOS } from "./fixtures/solenos-valid";

console.log("=== Semantic Role Isolation — Implementation Enforcement ===\n");

for (const marker of SYSTEM_PROMPT_SPEC_MARKERS) {
  if (!SOLENOS_SYSTEM_PROMPT.includes(marker)) {
    throw new Error(`system prompt missing marker: ${marker}`);
  }
}
console.log("✓ enforcement system prompt markers");

const valid = validateAIResponse(VERIFY_VALID_SOLENOS);
if (!isSemanticRoleIsolationValid(valid)) {
  throw new Error(`valid fixture must pass isolation: ${validateSemanticRoleIsolation(valid).violations.join(",")}`);
}
console.log("✓ shared fixture respects semantic role boundaries");

const example = validateAIResponse(VERIFY_SEMANTIC_ROLE_EXAMPLE);
if (!isSemanticRoleIsolationValid(example)) {
  throw new Error(`canonical example must pass: ${validateSemanticRoleIsolation(example).violations.join(",")}`);
}
console.log("✓ canonical contract example validates");

const groundedOk = validateSemanticRoleIsolation(
  validateAIResponse({
    ...VERIFY_VALID_SOLENOS,
    what_is_happening:
      "There has been a change in daily functioning involving eating, medication adherence, and activity level.",
  }),
);
if (!groundedOk.valid) {
  throw new Error(`grounded interpretation must pass: ${groundedOk.violations.join(",")}`);
}
console.log("✓ allows grounded interpretation in what_is_happening");

const priorityLeak = validateSemanticRoleIsolation(
  validateAIResponse({
    ...VERIFY_VALID_SOLENOS,
    what_is_happening: "Medication was missed. The main immediate focus is confirming the dose.",
  }),
);
if (priorityLeak.valid) {
  throw new Error("what_is_happening must not contain prioritization");
}
console.log("✓ blocks priority leakage in what_is_happening");

const inferenceLeak = validateSemanticRoleIsolation(
  validateAIResponse({
    ...VERIFY_VALID_SOLENOS,
    what_is_happening: "He may be suffering from severe depression.",
  }),
);
if (inferenceLeak.valid) {
  throw new Error("what_is_happening must reject unsupported inference");
}
console.log("✓ blocks unsupported inference in what_is_happening");

const canWaitLeak = validateSemanticRoleIsolation(
  validateAIResponse({
    ...VERIFY_VALID_SOLENOS,
    what_can_wait: "This may be because he is depressed and needs urgent action now.",
  }),
);
if (canWaitLeak.valid) {
  throw new Error("what_can_wait must not contain interpretation or urgency");
}
console.log("✓ blocks interpretation/urgency leakage in what_can_wait");

const guiltValidationLeak = validateSemanticRoleIsolation(
  validateAIResponse({
    ...VERIFY_VALID_SOLENOS,
    what_is_happening: "It was your fault that the dose was missed.",
  }),
);
if (guiltValidationLeak.valid) {
  throw new Error("what_is_happening must not validate guilt narratives");
}
console.log("✓ blocks guilt validation in what_is_happening");

const retrospectiveLeak = validateSemanticRoleIsolation(
  validateAIResponse({
    ...VERIFY_VALID_SOLENOS,
    what_matters_now: "Retrospectively, if only you had called earlier the outcome might differ.",
  }),
);
if (retrospectiveLeak.valid) {
  throw new Error("what_matters_now must not contain retrospective simulation");
}
console.log("✓ blocks retrospective simulation in what_matters_now");

const selfBlameLeak = validateSemanticRoleIsolation(
  validateAIResponse({
    ...VERIFY_VALID_SOLENOS,
    what_is_happening: "You should have noticed the missed dose earlier.",
  }),
);
if (selfBlameLeak.valid) {
  throw new Error("what_is_happening must not contain guilt/self-blame language");
}
console.log("✓ blocks guilt/self-blame language in what_is_happening");

FailureLogEntrySchema.parse({
  timestamp: new Date().toISOString(),
  stage: "postprocess",
  failure_type: classifySemanticRoleIsolationFailure().failure_type,
  retry_count: 0,
});
console.log("✓ SEMANTIC_ROLE_ISOLATION_FAILURE logged via observability");

console.log(`\n✓ ${SEMANTIC_ROLE_CORE_RULE}`);
console.log(`✓ ${SEMANTIC_ROLE_FAILURE_MODEL}`);
console.log(`✓ ${SEMANTIC_ROLE_ONE_LINE_TRUTH}`);
