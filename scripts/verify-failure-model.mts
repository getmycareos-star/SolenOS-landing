import {
  assessSuccessMetrics,
  diagnoseQuestionFailure,
  formatFailureDiagnosis,
  formatProactiveSurfacePlan,
  formatSuccessMetrics,
  IDEAL_EXPERIENCE,
  planProactiveSurface,
  PRODUCT_INVARIANT,
} from "../src/lib/care-context";
import {
  HIRE_HELP_QUESTION,
  SAMPLE_CARE_CONTEXT,
} from "../src/data/sample-care-context";

console.log("=== PRODUCT INVARIANT ===\n");
console.log(PRODUCT_INVARIANT);
console.log(`\nIdeal experience: "${IDEAL_EXPERIENCE}"\n`);

console.log("=== CONTINUITY FAILURE: Should I hire professional help? ===\n");
const diagnosis = diagnoseQuestionFailure(
  HIRE_HELP_QUESTION,
  SAMPLE_CARE_CONTEXT,
);
console.log(formatFailureDiagnosis(diagnosis));

console.log("\n=== PROACTIVE SURFACE (before they ask) ===\n");
const plan = planProactiveSurface(SAMPLE_CARE_CONTEXT);
console.log(formatProactiveSurfacePlan(plan));

console.log("\n=== SUCCESS METRICS (inverse) ===\n");
const metrics = assessSuccessMetrics(SAMPLE_CARE_CONTEXT, {
  questions: [
    { text: "Is Dad getting worse?", askedAt: "2026-07-10" },
    { text: "Is Dad getting worse?", askedAt: "2026-07-12" },
    { text: "Should I hire help?", askedAt: "2026-07-13" },
  ],
});
console.log(formatSuccessMetrics(metrics));
