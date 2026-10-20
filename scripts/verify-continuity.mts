import {
  applyQuestionToContext,
  assessContinuity,
  createEmptyContext,
  formatContinuityAssessment,
  formatContextReasoning,
  interpretQuestion,
  reasonThroughContext,
} from "../src/lib/care-context";
import { EXAMPLE_CAREGIVER_QUESTION } from "../src/data/example-caregiver-question";
import {
  HIRE_HELP_QUESTION,
  SAMPLE_CARE_CONTEXT,
} from "../src/data/sample-care-context";

const referenceDate = "2026-07-13T09:00:00";

console.log("=== 1. QUESTION AS SIGNAL (not answer) ===\n");
const interpretation = interpretQuestion(EXAMPLE_CAREGIVER_QUESTION, {
  referenceDate,
});
console.log(`Demand: ${interpretation.demandType}`);
console.log(`Themes: ${interpretation.signalThemes.join(", ")}`);
console.log(`Engine actions: ${interpretation.engineActions.join(" → ")}`);

console.log("\n=== 2. CONTEXT REASONING: Should I hire professional help? ===\n");
const reasoning = reasonThroughContext(SAMPLE_CARE_CONTEXT, HIRE_HELP_QUESTION);
console.log(formatContextReasoning(reasoning));

console.log("\n=== 3. STATE OF CARE (continuity outputs) ===\n");
let context = createEmptyContext();
context = applyQuestionToContext(context, interpretation);
const assessment = assessContinuity(context);
console.log(formatContinuityAssessment(assessment));
