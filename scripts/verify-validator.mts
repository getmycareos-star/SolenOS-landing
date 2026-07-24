import {
  SolenOSResponseSchema,
  gateForUI,
  isValidationError,
  validateAIResponse,
} from "../src/lib/response-validator";

const valid = {
  what_is_happening:
    "The caregiver reports that evening medication was missed, which creates uncertainty about whether today's dose schedule is intact.",
  what_matters_now:
    "Confirm whether the missed evening dose was taken because medication timing affects safety and next-step decisions.",
  what_to_ask_next: "Did she take the evening dose?",
  risk_level: "medium" as const,
  what_can_wait:
    "Insurance calls and scheduling can wait until medication status is confirmed.",
};

console.log("=== response-validator — Zod Hard Gate v1 ===\n");

const parsed = validateAIResponse(valid);
console.log("✓ valid payload accepted");
SolenOSResponseSchema.parse(parsed);

const gated = gateForUI(valid);
console.log("✓ gateForUI validates full contract via strict schema");
if (Object.keys(gated).length !== 5) {
  throw new Error("gated output must have exactly 5 fields");
}

let rejected = false;
try {
  validateAIResponse({ ...valid, extra_field: "forbidden" });
} catch (e) {
  if (isValidationError(e)) {
    rejected = true;
    console.log("✓ extra fields rejected");
  }
}
if (!rejected) throw new Error("expected extra field rejection");

rejected = false;
try {
  validateAIResponse({ ...valid, follow_up_items: [] });
} catch (e) {
  if (isValidationError(e)) {
    rejected = true;
    console.log("✓ follow_up_items rejected");
  }
}
if (!rejected) throw new Error("expected follow_up_items rejection");

const legacyRisk = validateAIResponse({ ...valid, risk_level: "MEDIUM" });
if (legacyRisk.risk_level !== "medium") {
  throw new Error("legacy uppercase risk_level must normalize to lowercase");
}
console.log("✓ legacy uppercase risk_level normalizes to lowercase");

rejected = false;
try {
  validateAIResponse({ ...valid, risk_level: "unknown" });
} catch (e) {
  if (isValidationError(e)) rejected = true;
  console.log("✓ invalid risk_level rejected");
}
if (!rejected) throw new Error("expected invalid risk rejection");

console.log("\n✓ response-validator hard gate verified");
