import fs from "node:fs";
import {
  isEmotionalStabilizationValid,
  validateEmotionalStabilization,
} from "../src/lib/emotional-stabilization";
import { classifyEmotionalStabilizationFailure, FailureLogEntrySchema } from "../src/lib/failure-observability";
import { SOLENOS_SYSTEM_PROMPT } from "../src/lib/solenos-langchain-adapter/system-prompt";
import { stressNormalizeInput } from "../src/lib/input-stress-normalizer";
import { validateAIResponse } from "../src/lib/response-validator";
import { VERIFY_VALID_SOLENOS } from "./fixtures/solenos-valid";

console.log("=== Emotional Stabilization Contract ===\n");

if (!SOLENOS_SYSTEM_PROMPT.includes("what_is_happening")) {
  throw new Error("system prompt must define what_is_happening as the explanation layer");
}
console.log("✓ what_is_happening is the sole explanation layer in prompt");

const calmInput = stressNormalizeInput("Mom missed her evening medication.");
const calmOutput = validateAIResponse(VERIFY_VALID_SOLENOS);
const calmPass = validateEmotionalStabilization(calmOutput, calmInput);
if (!calmPass.valid) {
  throw new Error(`non-emotional input must pass: ${calmPass.violations.join(",")}`);
}
console.log("✓ non-emotional input passes without therapeutic language");

const distressedInput = stressNormalizeInput(
  "I am overwhelmed and terrified. She missed her evening medication.",
);
const paraphrasePass = validateEmotionalStabilization(
  validateAIResponse({
    ...VERIFY_VALID_SOLENOS,
    what_is_happening:
      "The caregiver reports feeling overwhelmed and terrified. Evening medication was missed. These are the only facts stated in the input.",
  }),
  distressedInput,
);
if (!paraphrasePass.valid) {
  throw new Error(`input paraphrase must pass: ${paraphrasePass.violations.join(",")}`);
}
console.log("✓ distressed input may be restated via paraphrase in what_is_happening");

const therapeutic = validateEmotionalStabilization(
  validateAIResponse({
    ...VERIFY_VALID_SOLENOS,
    what_is_happening: "It makes sense to feel overwhelmed. Everything will be okay.",
  }),
  distressedInput,
);
if (therapeutic.valid) {
  throw new Error("therapeutic simulation must fail");
}
console.log("✓ blocks therapeutic simulation language");

FailureLogEntrySchema.parse({
  timestamp: new Date().toISOString(),
  stage: "postprocess",
  failure_type: classifyEmotionalStabilizationFailure().failure_type,
  retry_count: 0,
});
console.log("✓ EMOTIONAL_STABILIZATION_FAILURE logged via observability");

console.log("\n✓ emotional stabilization aligned to paraphrase-only what_is_happening");
