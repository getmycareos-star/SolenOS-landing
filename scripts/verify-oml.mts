import {
  applyQuestionToContext,
  createEmptyContext,
  interpretQuestion,
} from "../src/lib/care-context";
import {
  closeSession,
  createEmptyOMLState,
  createFeedbackPrompt,
  createOMLSession,
  ENGINE_METRIC_MAP,
  formatOutcomeMeasurement,
  OML_PRINCIPLE,
  processCaregiverFeedback,
  recordClarityAchieved,
  recordDecisionSignal,
  recordSessionQuestion,
  recordReviewTime,
  updateCareContextWithOML,
} from "../src/lib/oml";
import { SAMPLE_CARE_CONTEXT } from "../src/data/sample-care-context";

console.log("=== OUTCOME MEASUREMENT LAYER ===\n");
console.log(OML_PRINCIPLE);
console.log(`\n${ENGINE_METRIC_MAP.length} engines declare measurable outcomes\n`);

let omlState = createEmptyOMLState();

// Simulate caregiver sessions over time
let session = createOMLSession();
session = recordSessionQuestion(session, "What changed this week?");
session = recordSessionQuestion(session, "Is Dad getting worse?");
session = recordReviewTime(session, 45);
session = recordClarityAchieved(session);
session = closeSession(session);
omlState = { ...omlState, sessions: [session] };

omlState = recordDecisionSignal(
  omlState,
  "no_action_confirmed",
  "Reviewed State of Care — monitoring recommended",
);

const { context: ctx1, omlState: oml1 } = updateCareContextWithOML(
  SAMPLE_CARE_CONTEXT,
  omlState,
);
console.log(formatOutcomeMeasurement(ctx1.oml!));

// Second update — simulate improvement
let session2 = createOMLSession();
session2 = recordSessionQuestion(session2, "Thanks, I understand now.");
session2 = recordReviewTime(session2, 12);
session2 = recordClarityAchieved(session2);
session2 = closeSession(session2);

const interpretation = interpretQuestion(
  "Headache seems better today.",
  { referenceDate: "2026-07-14T09:00:00" },
);
let context = createEmptyContext();
context = { ...SAMPLE_CARE_CONTEXT };
context = applyQuestionToContext(context, interpretation, {
  ...oml1,
  sessions: [...oml1.sessions, session2],
});

console.log("\n=== AFTER CONTEXT UPDATE (with delta) ===\n");
console.log(formatOutcomeMeasurement(context.oml!));

// Feedback hook
const { updatedState, calibration } = processCaregiverFeedback(oml1, {
  outputType: "state_of_care",
  helpfulness: "helpful",
  reducedConfusion: "yes",
  submittedAt: new Date().toISOString(),
});
console.log("\n=== FEEDBACK CALIBRATION ===");
console.log(JSON.stringify(calibration, null, 2));
console.log(`\nFeedback records: ${updatedState.feedback.length}`);

console.log("\n=== ENGINE → METRIC MAP (sample) ===");
for (const decl of ENGINE_METRIC_MAP.slice(0, 4)) {
  console.log(`${decl.engine} → ${decl.improvesMetrics.join(", ")}`);
}

console.log("\n=== FEEDBACK PROMPT ===");
console.log(createFeedbackPrompt("opening_surface").questions.join("\n"));
