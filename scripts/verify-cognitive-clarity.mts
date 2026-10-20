import {
  COGNITIVE_CLARITY_EVALUATION,
  COGNITIVE_CLARITY_IDENTITY,
  isCognitiveClarityValid,
  validateCognitiveClarity,
} from "../src/lib/cognitive-clarity";
import { NON_CONVERSATIONAL_CORE_PRINCIPLE } from "../src/lib/non-conversational";
import { validateAIResponse } from "../src/lib/response-validator";
import {
  classifyCognitiveClarityFailure,
  FailureLogEntrySchema,
} from "../src/lib/failure-observability";
import { SOLENOS_SYSTEM_PROMPT } from "../src/lib/solenos-langchain-adapter/system-prompt";
import { VERIFY_VALID_SOLENOS } from "./fixtures/solenos-valid";

console.log("=== Canonical Cognitive Clarity Contract ===\n");

if (!SOLENOS_SYSTEM_PROMPT.includes(NON_CONVERSATIONAL_CORE_PRINCIPLE)) {
  throw new Error("system prompt missing cognitive clarity / non-conversational principle");
}
if (!SOLENOS_SYSTEM_PROMPT.includes("Clarity in seconds, not sessions")) {
  throw new Error("system prompt missing cognitive load time-to-clarity rule");
}
console.log("✓ cognitive clarity + episodic relief principles in system prompt");

const safe = validateAIResponse(VERIFY_VALID_SOLENOS);
if (!isCognitiveClarityValid(safe)) {
  throw new Error("valid fixture must pass cognitive clarity gate");
}
console.log("✓ valid output passes cognitive load gate");

const academic = validateAIResponse({
  ...VERIFY_VALID_SOLENOS,
  what_matters_now:
    "Furthermore, the multifactorial manifestation of this pattern may warrant attention because priority matters now.",
});
if (isCognitiveClarityValid(academic)) {
  throw new Error("overintellectualized language must fail");
}
console.log("✓ blocks overintellectualized language");

const jargon = validateAIResponse({
  ...VERIFY_VALID_SOLENOS,
  what_is_happening:
    "The caregiver reports a manifestation that may facilitate uncertainty about the exacerbation pattern.",
});
if (isCognitiveClarityValid(jargon)) {
  throw new Error(" unnecessary jargon must fail");
}
console.log("✓ blocks unnecessary jargon");

FailureLogEntrySchema.parse({
  timestamp: new Date().toISOString(),
  stage: "postprocess",
  failure_type: classifyCognitiveClarityFailure().failure_type,
  retry_count: 0,
});
console.log("✓ COGNITIVE_CLARITY_FAILURE logged via observability");

console.log(`\n✓ ${NON_CONVERSATIONAL_CORE_PRINCIPLE}`);
console.log(`✓ ${COGNITIVE_CLARITY_EVALUATION}`);
console.log(`✓ ${COGNITIVE_CLARITY_IDENTITY}`);
