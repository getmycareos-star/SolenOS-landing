import { validateGrounding } from "../src/lib/grounding-validation";
import { validateAIResponse } from "../src/lib/response-validator";
import { VERIFY_VALID_SOLENOS } from "./fixtures/solenos-valid";
import { stressNormalizeInput } from "../src/lib/input-stress-normalizer";
import { applyContextWindowStrategy } from "../src/lib/context-window-strategy";
import {
  classifyGroundingFailure,
  FailureLogEntrySchema,
} from "../src/lib/failure-observability";

console.log("=== SolenOS — GROUNDING VALIDATION (Execution Contract) ===\n");

const input = stressNormalizeInput("Mom missed her evening medication.");
const contextWindow = applyContextWindowStrategy(input);
const grounded = validateAIResponse(VERIFY_VALID_SOLENOS);

const pass = validateGrounding(grounded, input, contextWindow);
if (!pass.valid) {
  throw new Error(`valid fixture must pass grounding: ${pass.violations.join(",")}`);
}
console.log("✓ grounded fixture passes validation");

const inferred = validateGrounding(
  {
    ...grounded,
    what_is_happening:
      "She likely has a urinary tract infection based on the symptoms described.",
  },
  input,
  contextWindow,
);
if (inferred.valid) {
  throw new Error("inferred condition must fail grounding");
}
console.log("✓ blocks inferred conditions");

const guessed = validateGrounding(
  {
    ...grounded,
    what_matters_now:
      "The cause is probably stress and this must be addressed immediately because safety.",
  },
  input,
  contextWindow,
);
if (guessed.valid) {
  throw new Error("guessed cause must fail grounding");
}
console.log("✓ blocks guessed causes");

const incompleteInput = stressNormalizeInput("Something happened but I don't know what.");
const completedMissing = validateGrounding(
  {
    ...grounded,
    what_is_happening: "She definitely missed her dose and the schedule is fully disrupted.",
  },
  incompleteInput,
  applyContextWindowStrategy(incompleteInput),
);
if (completedMissing.valid) {
  throw new Error("completed missing data on incomplete input must fail");
}
console.log("✓ blocks narrative completion on incomplete input");

FailureLogEntrySchema.parse({
  timestamp: new Date().toISOString(),
  stage: "postprocess",
  failure_type: classifyGroundingFailure().failure_type,
  retry_count: 0,
});
console.log("✓ GROUNDING_VALIDATION_FAILURE logged via observability");

console.log("\n✓ grounding validation enforced — no inference or hallucination");
