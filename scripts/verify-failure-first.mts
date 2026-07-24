import {
  buildOpeningSurface,
  classifyCaregiverFailure,
  evaluateFeature,
  FAILURE_FIRST_MAP,
  FAILURE_ENGINE_MAP,
  formatFailureFirstDiagnosis,
  formatFeatureEvaluation,
  formatOpeningSurface,
  formatProactiveSurfacePlan,
  PRODUCT_INVARIANT,
  planProactiveSurface,
} from "../src/lib/care-context";
import { SAMPLE_CARE_CONTEXT } from "../src/data/sample-care-context";

console.log("=== FAILURE-FIRST PRODUCT INTELLIGENCE ===\n");
console.log(PRODUCT_INVARIANT);
console.log(`\n${FAILURE_ENGINE_MAP.length} failure categories → engines mapped`);
console.log(`${FAILURE_FIRST_MAP.length} question archetypes classified\n`);

const questions = [
  "Is it time for 24/7 care?",
  "Am I doing enough?",
  "I can't remember what happened at the last appointment.",
  "Should I hire professional help?",
  "Is this behavior normal?",
  "I'm overwhelmed.",
  "Does Medicare cover dementia care?",
];

for (const q of questions) {
  console.log("---");
  const diagnosis = classifyCaregiverFailure(q, SAMPLE_CARE_CONTEXT);
  console.log(formatFailureFirstDiagnosis(diagnosis));
  console.log("");
}

console.log("=== OPENING SURFACE (question disappears) ===\n");
console.log(formatOpeningSurface(buildOpeningSurface(SAMPLE_CARE_CONTEXT)));

console.log("\n=== FEATURE EVALUATION ===\n");
console.log(
  formatFeatureEvaluation(
    evaluateFeature("Care Snapshot Export", {
      failureSolved: "memory_reconstruction_failure",
      reducesUncertainty: true,
      reducesCognitiveLoad: true,
      reducesReconstruction: true,
      reducesQuestions: true,
    }),
  ),
);
console.log("");
console.log(
  formatFeatureEvaluation(
    evaluateFeature("Medicare FAQ Chatbot", {
      failureSolved: "information_not_eliminable_by_continuity",
      reducesUncertainty: true,
      reducesCognitiveLoad: false,
      reducesReconstruction: false,
      reducesQuestions: false,
    }),
  ),
);

console.log("\n=== PROACTIVE PLAN ===\n");
console.log(formatProactiveSurfacePlan(planProactiveSurface(SAMPLE_CARE_CONTEXT)));
