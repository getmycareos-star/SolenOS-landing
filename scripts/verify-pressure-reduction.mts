import fs from "node:fs";
import path from "node:path";
import {
  PRESSURE_REDUCTION_BEHAVIOR_GUARANTEES,
  PRESSURE_REDUCTION_FAILURE_MODEL,
  PRESSURE_REDUCTION_ONE_LINE_TRUTH,
  PRESSURE_REDUCTION_SYSTEM_REALITY,
  isPressureReductionValid,
  validatePressureReduction,
} from "../src/lib/pressure-reduction";
import { classifyPressureReductionFailure, FailureLogEntrySchema } from "../src/lib/failure-observability";
import { SOLENOS_SYSTEM_PROMPT, SYSTEM_PROMPT_SPEC_MARKERS } from "../src/lib/solenos-langchain-adapter/system-prompt";
import { validateAIResponse } from "../src/lib/response-validator";
import { VERIFY_VALID_SOLENOS } from "./fixtures/solenos-valid";

console.log("=== Caregiver Pressure Reduction System ===\n");

if (!PRESSURE_REDUCTION_SYSTEM_REALITY.includes("pressure reduction layer")) {
  throw new Error("system reality drift");
}
if (!PRESSURE_REDUCTION_ONE_LINE_TRUTH.includes("think less painfully")) {
  throw new Error("one-line truth drift");
}
if (PRESSURE_REDUCTION_BEHAVIOR_GUARANTEES.length !== 6) {
  throw new Error("behavior guarantees drift");
}
console.log("✓ product contract constants");

for (const marker of SYSTEM_PROMPT_SPEC_MARKERS) {
  if (!SOLENOS_SYSTEM_PROMPT.includes(marker)) {
    throw new Error(`system prompt missing marker: ${marker}`);
  }
}
console.log("✓ pressure reduction system prompt markers");

const valid = validateAIResponse(VERIFY_VALID_SOLENOS);
if (!isPressureReductionValid(valid)) {
  throw new Error("valid fixture must pass pressure reduction gate");
}
console.log("✓ shared fixture passes pressure reduction gate");

const planning = validatePressureReduction(
  validateAIResponse({
    ...VERIFY_VALID_SOLENOS,
    what_matters_now: "Create a care plan with an action plan for the next week.",
  }),
);
if (planning.valid) {
  throw new Error("planning system language must fail");
}
console.log("✓ blocks planning system language");

const workflow = validatePressureReduction(
  validateAIResponse({
    ...VERIFY_VALID_SOLENOS,
    what_can_wait: "Set up your dashboard checklist and task list later.",
  }),
);
if (workflow.valid) {
  throw new Error("workflow creation must fail");
}
console.log("✓ blocks workflow creation");

const selfBlame = validatePressureReduction(
  validateAIResponse({
    ...VERIFY_VALID_SOLENOS,
    what_is_happening: "You failed to notice the missed dose and you're doing this wrong.",
  }),
);
if (selfBlame.valid) {
  throw new Error("self-blame amplification must fail");
}
console.log("✓ blocks self-blame amplification");

const emotional = validatePressureReduction(
  validateAIResponse({
    ...VERIFY_VALID_SOLENOS,
    what_is_happening: "I understand this feels overwhelming and don't blame yourself.",
  }),
);
if (emotional.valid) {
  throw new Error("emotional framing inside structure must fail");
}
console.log("✓ blocks emotional framing inside structured output");

const pipelineSource = fs.readFileSync(
  path.join(process.cwd(), "src/lib/analyze-pipeline/index.ts"),
  "utf-8",
);
if (!pipelineSource.includes("isPressureReductionValid(epistemicOutput)")) {
  throw new Error("analyze pipeline must wire pressure reduction gate");
}
console.log("✓ pressure reduction gate wired in analyze pipeline");

FailureLogEntrySchema.parse({
  timestamp: new Date().toISOString(),
  stage: "postprocess",
  failure_type: classifyPressureReductionFailure().failure_type,
  retry_count: 0,
});
console.log("✓ PRESSURE_REDUCTION_FAILURE logged via observability");

console.log(`\n✓ ${PRESSURE_REDUCTION_FAILURE_MODEL}`);
