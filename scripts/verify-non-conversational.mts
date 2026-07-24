import {
  isNonConversationalValid,
  NON_CONVERSATIONAL_CORE_PRINCIPLE,
  NON_CONVERSATIONAL_FAILURE_MODEL,
  NON_CONVERSATIONAL_ONE_LINE_TRUTH,
  validateNonConversational,
} from "../src/lib/non-conversational";
import { withMeta } from "../src/lib/response-validator";
import {
  classifyNonConversationalFailure,
  FailureLogEntrySchema,
} from "../src/lib/failure-observability";
import { SOLENOS_SYSTEM_PROMPT, SYSTEM_PROMPT_SPEC_MARKERS } from "../src/lib/solenos-langchain-adapter/system-prompt";
import { VERIFY_VALID_SOLENOS } from "./fixtures/solenos-valid";

console.log("=== Non-Conversational Cognitive Transformation Engine ===\n");

for (const marker of SYSTEM_PROMPT_SPEC_MARKERS) {
  if (!SOLENOS_SYSTEM_PROMPT.includes(marker)) {
    throw new Error(`system prompt missing marker: ${marker}`);
  }
}
if (!SOLENOS_SYSTEM_PROMPT.includes(NON_CONVERSATIONAL_CORE_PRINCIPLE)) {
  throw new Error("system prompt missing non-conversational principle");
}
console.log("✓ non-conversational markers in episodic system prompt");

const safe = withMeta(VERIFY_VALID_SOLENOS);
if (!isNonConversationalValid(safe)) {
  throw new Error("valid fixture must pass non-conversational gate");
}
console.log("✓ valid transformation output passes non-conversational gate");

const chatbot = withMeta({
  ...VERIFY_VALID_SOLENOS,
  what_is_happening: "Hi there! I can help. Here's what I think is happening based on what you shared.",
});
if (isNonConversationalValid(chatbot)) {
  throw new Error("chatbot greeting and filler must fail");
}
console.log("✓ blocks greetings and filler phrases");

const conversationalQuestion = {
  ...VERIFY_VALID_SOLENOS,
  what_to_ask_next: "Could you tell me if she took the evening dose?",
};
if (isNonConversationalValid(conversationalQuestion)) {
  throw new Error("conversational question format must fail");
}
console.log("✓ blocks conversational question phrasing in what_to_ask_next");

FailureLogEntrySchema.parse({
  timestamp: new Date().toISOString(),
  stage: "postprocess",
  failure_type: classifyNonConversationalFailure().failure_type,
  retry_count: 0,
});
console.log("✓ NON_CONVERSATIONAL_FAILURE logged via observability");

console.log(`\n✓ ${NON_CONVERSATIONAL_CORE_PRINCIPLE}`);
console.log(`✓ ${NON_CONVERSATIONAL_FAILURE_MODEL}`);
