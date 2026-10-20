import {
  CALIBRATED_UNCERTAINTY_BALANCE_PRINCIPLE,
  CALIBRATED_UNCERTAINTY_FAILURE_MODEL,
  CALIBRATED_UNCERTAINTY_ONE_LINE_TRUTH,
  isCalibratedUncertaintyValid,
  validateCalibratedUncertainty,
} from "../src/lib/calibrated-uncertainty";
import { validateAIResponse } from "../src/lib/response-validator";
import {
  classifyCalibratedUncertaintyFailure,
  FailureLogEntrySchema,
} from "../src/lib/failure-observability";
import { VERIFY_VALID_SOLENOS } from "./fixtures/solenos-valid";

console.log("=== Anti-Guarantee + Calibrated Uncertainty Contract ===\n");

const safe = validateAIResponse(VERIFY_VALID_SOLENOS);
if (!isCalibratedUncertaintyValid(safe)) {
  throw new Error("uncertainty-preserving sample must pass calibrated uncertainty gate");
}
console.log("✓ valid output passes calibrated uncertainty gate");

const guarantee = validateAIResponse({
  ...VERIFY_VALID_SOLENOS,
  what_can_wait: "Everything is fine — nothing to worry about here.",
});
if (isCalibratedUncertaintyValid(guarantee)) {
  throw new Error("guarantee language must fail");
}
console.log("✓ blocks guarantee language");

const lowRiskSafe = validateAIResponse({
  ...VERIFY_VALID_SOLENOS,
  risk_level: "low",
  what_matters_now: "This reading is harmless and not concerning based on what was shared.",
});
if (isCalibratedUncertaintyValid(lowRiskSafe)) {
  throw new Error("low risk read as safe must fail");
}
console.log("✓ low risk must not read as safe/harmless");

const paralysis = validateAIResponse({
  ...VERIFY_VALID_SOLENOS,
  what_is_happening: "Cannot be determined from input.",
  what_matters_now: "Cannot be determined from input.",
  what_to_ask_next: "Cannot be determined from input?",
  what_can_wait: "Unable to determine from input.",
});
if (isCalibratedUncertaintyValid(paralysis)) {
  throw new Error("interpretive paralysis must fail");
}
console.log("✓ blocks interpretive paralysis");

const escalationMissing = validateAIResponse({
  ...VERIFY_VALID_SOLENOS,
  what_is_happening: "The note mentions a date only; missing deadline context remains unclear.",
  what_matters_now: "The note mentions a date only.",
  what_to_ask_next: "Review the document again.",
});
if (isCalibratedUncertaintyValid(escalationMissing)) {
  throw new Error("incomplete context without escalation pathway must fail");
}
console.log("✓ preserves escalation pathways when context incomplete");

FailureLogEntrySchema.parse({
  timestamp: new Date().toISOString(),
  stage: "postprocess",
  failure_type: classifyCalibratedUncertaintyFailure().failure_type,
  retry_count: 0,
});
console.log("✓ CALIBRATED_UNCERTAINTY_FAILURE logged via observability");

console.log(`\n✓ ${CALIBRATED_UNCERTAINTY_FAILURE_MODEL}`);
console.log(`✓ ${CALIBRATED_UNCERTAINTY_BALANCE_PRINCIPLE}`);
console.log(`✓ ${CALIBRATED_UNCERTAINTY_ONE_LINE_TRUTH}`);
