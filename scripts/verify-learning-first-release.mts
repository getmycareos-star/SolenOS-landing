/**
 * Learning-first release — feedback capture + research preview; no polish theater.
 * SoT: docs/02-product/solenos-learning-first-release.md
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  LEARNING_FIRST_PURPOSE,
  LEARNING_FIRST_HYPOTHESIS,
  RESEARCH_PREVIEW_NOTICE,
  UNDERSTANDING_FEEDBACK_PROMPT,
  UNDERSTANDING_FEEDBACK_NO_PROMPTS,
  LEARNING_FIRST_PRIORITY,
  LEARNING_FIRST_DEPRIORITIZE,
  LEARNING_FIRST_NON_NEGOTIABLES,
} from "../src/lib/learning-first-release";
import {
  recordUnderstandingFeedback,
  listUnderstandingFeedback,
  resetResearchFeedbackStore,
  RESEARCH_FEEDBACK_PURPOSE,
} from "../src/lib/research-feedback";

const root = process.cwd();

console.log("=== Learning-First Release ===\n");
console.log(LEARNING_FIRST_PURPOSE);
console.log(RESEARCH_FEEDBACK_PURPOSE);

assert.ok(/understand the situation more clearly/i.test(LEARNING_FIRST_HYPOTHESIS));
assert.ok(/research preview/i.test(RESEARCH_PREVIEW_NOTICE));
assert.ok(/help you understand/i.test(UNDERSTANDING_FEEDBACK_PROMPT));
assert.equal(UNDERSTANDING_FEEDBACK_NO_PROMPTS.length, 4);
assert.ok(LEARNING_FIRST_PRIORITY.includes("prevent_data_loss"));
assert.ok(LEARNING_FIRST_DEPRIORITIZE.includes("ui_polish"));
assert.ok(LEARNING_FIRST_NON_NEGOTIABLES.includes("never_fabricate_medical_information"));
console.log("✓ learning-first contracts");

{
  resetResearchFeedbackStore();
  const yes = recordUnderstandingFeedback({
    careKey: "cg_learn_yes",
    helpedUnderstand: true,
    rawInputExcerpt: "She asked the same question twice.",
  });
  assert.equal(yes.helped_understand, true);
  assert.equal(yes.missed, null);

  const no = recordUnderstandingFeedback({
    careKey: "cg_learn_no",
    helpedUnderstand: false,
    missed: "Did not connect to the hospital visit",
    expectedUnderstanding: "That evenings are harder",
    confusing: "Unclear what changed",
    expectedNotice: "Brother only sees weekends",
  });
  assert.equal(no.helped_understand, false);
  assert.ok(no.missed?.includes("hospital"));
  const listed = listUnderstandingFeedback("cg_learn_no");
  assert.equal(listed.length, 1);
  assert.ok(listed[0]!.expected_notice);
  console.log("✓ research feedback persisted (yes + no with details)");
}

{
  const sot = path.join(root, "docs/02-product/solenos-learning-first-release.md");
  assert.ok(fs.existsSync(sot));
  const rule = path.join(root, ".cursor/rules/solenos-learning-first-release.mdc");
  assert.ok(fs.existsSync(rule));
  const api = path.join(root, "src/app/api/research-feedback/route.ts");
  assert.ok(fs.existsSync(api));
  const panel = fs.readFileSync(
    path.join(root, "src/components/mvp-workspace/LivingCareRecordPanel.tsx"),
    "utf8",
  );
  assert.ok(panel.includes("UnderstandingFeedbackPrompt"));
  const workspace = fs.readFileSync(
    path.join(root, "src/components/mvp-workspace/CognitiveWorkspace.tsx"),
    "utf8",
  );
  assert.ok(workspace.includes("IN_APP_IMPROVING_NOTICE"));
  assert.ok(workspace.includes("careKey={caregiverId}"));
  const ack = fs.readFileSync(
    path.join(root, "src", "components", "mvp-workspace", "ResearchPreviewAckGate.tsx"),
    "utf8",
  );
  assert.ok(ack.includes("hasResearchPreviewAck"));
  // Must not be a polish-heavy redesign of the panel
  assert.ok(!/animate-|keyframes|gradient-glow/i.test(panel));
  console.log("✓ SoT + rule + API + panel wiring + research preview");
}

console.log("\n=== Learning-First Release: all checks passed ===\n");
