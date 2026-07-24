import {
  CHAOS_TO_CLARITY_CORE_PRINCIPLE,
  CHAOS_TO_CLARITY_FAILURE_MODEL,
  CHAOS_TO_CLARITY_ONE_LINE_TRUTH,
  isChaosToClarityValid,
  validateChaosToClarity,
} from "../src/lib/chaos-to-clarity";
import { withMeta } from "../src/lib/response-validator";
import {
  classifyChaosToClarityFailure,
  FailureLogEntrySchema,
} from "../src/lib/failure-observability";
import { SOLENOS_SYSTEM_PROMPT, SYSTEM_PROMPT_SPEC_MARKERS } from "../src/lib/solenos-langchain-adapter/system-prompt";
import { stressNormalizeInput } from "../src/lib/input-stress-normalizer";
import { VERIFY_VALID_SOLENOS } from "./fixtures/solenos-valid";

console.log("=== Chaos-to-Clarity Transformation Engine ===\n");

for (const marker of SYSTEM_PROMPT_SPEC_MARKERS) {
  if (!SOLENOS_SYSTEM_PROMPT.includes(marker)) {
    throw new Error(`system prompt missing chaos-to-clarity marker: ${marker}`);
  }
}
console.log("✓ chaos-to-clarity system prompt markers");

const safe = withMeta(VERIFY_VALID_SOLENOS);
const input = stressNormalizeInput("Mom missed her evening medication.");
if (!isChaosToClarityValid(safe, input)) {
  throw new Error("valid fixture must pass chaos-to-clarity gate");
}
console.log("✓ valid grounded output passes chaos-to-clarity gate");

const narrative = withMeta({
  ...VERIFY_VALID_SOLENOS,
  what_is_happening:
    "Putting everything together, the full story is that she missed her evening dose and became confused.",
});
if (isChaosToClarityValid(narrative, input)) {
  throw new Error("narrative synthesis must fail");
}
console.log("✓ blocks narrative synthesis");

const inference = withMeta({
  ...VERIFY_VALID_SOLENOS,
  what_matters_now: "We can conclude that she deliberately skipped the evening dose.",
});
if (isChaosToClarityValid(inference, input)) {
  throw new Error("inference completion must fail");
}
console.log("✓ blocks inference completion");

const causality = withMeta({
  ...VERIFY_VALID_SOLENOS,
  what_is_happening:
    "The caregiver reports a missed dose, which caused her blood sugar to drop overnight.",
});
if (isChaosToClarityValid(causality, input)) {
  throw new Error("unstated causality must fail");
}
console.log("✓ blocks unstated causality invention");

const contradictoryInput = stressNormalizeInput(
  "She took the pill. She did not take the pill. I don't know what happened.",
);
const reconciled = withMeta({
  ...VERIFY_VALID_SOLENOS,
  what_is_happening:
    "Actually she did take the pill; the earlier statement was incorrect.",
});
if (isChaosToClarityValid(reconciled, contradictoryInput)) {
  throw new Error("contradiction reconciliation must fail when input has contradictions");
}
console.log("✓ blocks contradiction reconciliation");

const reasoning = withMeta({
  ...VERIFY_VALID_SOLENOS,
  what_can_wait: "Therefore insurance calls can wait until medication status is confirmed.",
});
if (isChaosToClarityValid(reasoning, input)) {
  throw new Error("reasoning engine language must fail");
}
console.log("✓ blocks reasoning engine language");

const summarizer = withMeta({
  ...VERIFY_VALID_SOLENOS,
  what_is_happening: "In brief, the patient missed her evening medication dose.",
});
if (isChaosToClarityValid(summarizer, input)) {
  throw new Error("summarizer behavior must fail");
}
console.log("✓ blocks summarizer behavior");

const incompleteInput = stressNormalizeInput("Something is wrong but I don't know what happened.");
const missingUncertainty = {
  ...VERIFY_VALID_SOLENOS,
  what_is_happening: "She missed her evening medication and the schedule is disrupted.",
};
const uncertaintyCheck = validateChaosToClarity(missingUncertainty, incompleteInput);
if (uncertaintyCheck.valid) {
  throw new Error("incomplete input without uncertainty separation must fail");
}
console.log("✓ requires uncertainty separation for incomplete input");

FailureLogEntrySchema.parse({
  timestamp: new Date().toISOString(),
  stage: "postprocess",
  failure_type: classifyChaosToClarityFailure().failure_type,
  retry_count: 0,
});
console.log("✓ CHAOS_TO_CLARITY_FAILURE logged via observability");

console.log(`\n✓ ${CHAOS_TO_CLARITY_CORE_PRINCIPLE}`);
console.log(`✓ ${CHAOS_TO_CLARITY_FAILURE_MODEL}`);
console.log(`✓ ${CHAOS_TO_CLARITY_ONE_LINE_TRUTH}`);
