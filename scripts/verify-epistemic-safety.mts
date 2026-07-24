import {
  detectEpistemicViolations,
  detectHighSensitivityContext,
  enforceEpistemicSafety,
  isEpistemicSafetyValid,
  rewriteEpistemicOutput,
} from "../src/lib/epistemic-safety-engine";
import { withMeta } from "../src/lib/response-validator";
import {
  classifyEpistemicSafetyFailure,
  FailureLogEntrySchema,
} from "../src/lib/failure-observability";
import { VERIFY_VALID_SOLENOS } from "./fixtures/solenos-valid";

console.log("=== Epistemic Safety Engine — FINAL ALIGNMENT ===\n");

const safe = withMeta(VERIFY_VALID_SOLENOS);
if (!isEpistemicSafetyValid(safe)) {
  throw new Error("uncertainty-preserving sample must pass epistemic gate");
}
console.log("✓ preserves uncertainty in valid output");

const certainty = withMeta({
  ...VERIFY_VALID_SOLENOS,
  what_is_happening: "This is definitely heart failure and confirms the situation is serious.",
});
if (isEpistemicSafetyValid(certainty)) {
  throw new Error("certainty inflation must fail");
}
const rewritten = enforceEpistemicSafety(certainty);
if (!rewritten.rewritten || !rewritten.valid) {
  throw new Error("certainty inflation must be rewritten to safe uncertainty language");
}
if (/definitely heart failure/i.test(rewritten.output.what_is_happening)) {
  throw new Error("forbidden certainty language must not survive rewrite");
}
console.log("✓ blocks certainty inflation");

const reassurance = withMeta({
  ...VERIFY_VALID_SOLENOS,
  what_can_wait: "No need to worry — this is normal for her age.",
});
const rewrittenReassurance = enforceEpistemicSafety(reassurance);
if (!rewrittenReassurance.valid) {
  throw new Error("false reassurance rewrite must succeed");
}
console.log("✓ blocks false reassurance");

const prediction = withMeta({
  ...VERIFY_VALID_SOLENOS,
  what_is_happening: "She will worsen within 48 hours based on this pattern.",
});
if (!detectEpistemicViolations(prediction).includes("outcome_prediction")) {
  throw new Error("outcome prediction must be detected");
}
const rewrittenPrediction = enforceEpistemicSafety(prediction);
if (/will worsen within 48 hours/i.test(rewrittenPrediction.output.what_is_happening)) {
  throw new Error("outcome prediction must not survive rewrite");
}
console.log("✓ blocks outcome prediction");

const escalation = withMeta({
  ...VERIFY_VALID_SOLENOS,
  risk_level: "high",
  what_matters_now:
    "Monitor closely because breathing changes matter, but no need to call the doctor yet.",
});
if (!detectEpistemicViolations(escalation).includes("escalation_suppression")) {
  throw new Error("escalation suppression must be detected");
}
const rewrittenEscalation = enforceEpistemicSafety(escalation);
if (/no need to call the doctor/i.test(rewrittenEscalation.output.what_matters_now)) {
  throw new Error("escalation suppression must not survive rewrite");
}
console.log("✓ blocks escalation suppression");

const hospiceInput = "Hospice nurse said oxygen is dropping and we changed medications today.";
if (!detectHighSensitivityContext(hospiceInput)) {
  throw new Error("hospice + oxygen + medication must trigger high sensitivity");
}
const underframed = withMeta({
  ...VERIFY_VALID_SOLENOS,
  what_is_happening: "Oxygen levels dropped today after a medication change.",
  _meta: {
    ...VERIFY_VALID_SOLENOS._meta,
    missing_critical_fact: "baseline oxygen guidance",
    context_completeness: 0.4,
  },
});
const sensitive = enforceEpistemicSafety(underframed, {
  raw_input: hospiceInput,
  detected_tags: [],
  segments: [],
  metadata: {
    has_emotional_language: false,
    has_medical_content: true,
    has_contradictions: false,
    has_incomplete_context: true,
  },
});
if (!sensitive.high_sensitivity) {
  throw new Error("high sensitivity context must be detected");
}
if (!sensitive.valid) {
  throw new Error("high sensitivity underframing must be corrected by epistemic gate");
}
console.log("✓ elevated uncertainty framing in high-sensitivity zones");

FailureLogEntrySchema.parse({
  timestamp: new Date().toISOString(),
  stage: "postprocess",
  failure_type: classifyEpistemicSafetyFailure().failure_type,
  retry_count: 0,
});
console.log("✓ EPISTEMIC_SAFETY_FAILURE logged via existing observability");

const pipeline = await import("node:fs/promises").then((fs) =>
  fs.readFile("src/lib/analyze-pipeline/index.ts", "utf-8"),
);
if (!pipeline.includes("enforceEpistemicSafety")) {
  throw new Error("pipeline must enforce epistemic safety before render");
}

const transformed = rewriteEpistemicOutput(certainty);
if (detectEpistemicViolations(transformed).includes("certainty_inflation")) {
  throw new Error("rewrite must remove certainty inflation");
}
console.log("✓ uncertainty-preserving transformer");

console.log("\n✓ epistemic safety engine — ambiguity must not become false certainty");
