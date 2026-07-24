/**
 * verify-feedback-containment.mts
 * Phase 5.3 — feedback affects load/containment only; never copy templates or scores.
 */
import "./_verify-env.mts";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  applyFeedbackContainmentToRelief,
  peekFeedbackContainmentAdaptation,
  resetFeedbackContainmentStore,
  setFeedbackContainmentFromFeedback,
  shouldApplyFeedbackContainment,
} from "../src/lib/telemetry-persistence/feedback-containment";
import { decideReliefDisclosure } from "../src/lib/response-contract/relief-decision";
import {
  ingestActiveCareObservation,
  resetActiveCareSituationStore,
} from "../src/lib/active-care-situation";
import { resetCareRealityStateStore } from "../src/lib/care-reality-state";
import { composeCaregiverResponse } from "../src/lib/caregiver-response-composer";
import { resolveReliefDecisionForTurn } from "../src/lib/response-behavior";
import { classifyCareEventKind } from "../src/lib/living-care-record-ux";
import { classifyCaregiverTurn } from "../src/lib/response-behavior";

import { resetMultiCaregiverContextStore } from "../src/lib/multi-caregiver-context-model";

const root = process.cwd();

function resetAll(): void {
  resetActiveCareSituationStore();
  resetCareRealityStateStore();
  resetFeedbackContainmentStore();
  resetMultiCaregiverContextStore();
}

console.log("=== Feedback → Containment (Phase 5.3) ===\n");

// Unit — confusion only; helpful alone does not trigger
{
  assert.equal(shouldApplyFeedbackContainment({ helpful_yes_no: true, reduced_confusion_yes_no: true }), false);
  assert.equal(shouldApplyFeedbackContainment({ helpful_yes_no: true, reduced_confusion_yes_no: false }), true);
  assert.equal(shouldApplyFeedbackContainment({ helpful_yes_no: false, reduced_confusion_yes_no: false }), true);
  assert.equal(shouldApplyFeedbackContainment({ helpful_yes_no: false, reduced_confusion_yes_no: true }), false);
  console.log("✓ confusion signal gate — helpful alone never triggers");
}

// Unit — apply holds Clarity and zero asks
{
  const base = decideReliefDisclosure({
    turnClass: "observation",
    softVague: false,
    understandingSufficient: true,
    careContextGapsRemain: true,
    careWorthyCount: 2,
    latestIsCareWorthy: true,
    latestRawText: "Mom fell yesterday.",
  });
  assert.equal(base.show_clarity, true, "baseline has Clarity");
  assert.ok(base.max_asks >= 1, "baseline has asks");

  const adapted = applyFeedbackContainmentToRelief(base, {
    active: true,
    hold_clarity: true,
    max_asks_cap: 0,
    reason: "confusion_feedback",
  });
  assert.equal(adapted.show_clarity, false, "containment holds Clarity");
  assert.equal(adapted.max_asks, 0, "containment zero ask cap");
  assert.equal(adapted.show_asks, false, "containment disables asks");
  console.log("✓ applyFeedbackContainmentToRelief — load/containment only");
}

// Helpful feedback → no containment record
{
  resetFeedbackContainmentStore();
  const result = setFeedbackContainmentFromFeedback({
    careKey: "cg_helpful_only",
    feedback: { helpful_yes_no: true, reduced_confusion_yes_no: true },
  });
  assert.equal(result, null, "helpful + reduced confusion → no containment");
  assert.equal(peekFeedbackContainmentAdaptation("cg_helpful_only").active, false);
  console.log("✓ helpful feedback → no disclosure change");
}

// Confusion feedback → one-turn containment consumed on next relief resolve
{
  resetAll();
  const careKey = "cg_confusion_next";
  setFeedbackContainmentFromFeedback({
    careKey,
    feedback: { helpful_yes_no: true, reduced_confusion_yes_no: false },
  });
  assert.equal(peekFeedbackContainmentAdaptation(careKey).active, true);

  const fall = "Mom fell yesterday. We went to urgent care.";
  const turn = ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: fall,
    kind: classifyCareEventKind(fall),
    nowIso: "2026-12-01T10:00:00.000Z",
  });
  const turnClass = classifyCaregiverTurn({
    latestRawText: fall,
    kind: classifyCareEventKind(fall),
    turn,
  });
  const relief = resolveReliefDecisionForTurn({ turn, turnClass, latestRawText: fall });
  assert.equal(relief.show_clarity, false, "first turn after confusion holds Clarity");
  assert.equal(relief.max_asks, 0, "first turn after confusion zero asks");

  composeCaregiverResponse({ turn, latestRawText: fall, kind: classifyCareEventKind(fall) });

  const relief2 = resolveReliefDecisionForTurn({ turn, turnClass, latestRawText: fall });
  assert.equal(relief2.show_clarity, true, "containment consumed — Clarity restored");
  assert.ok(relief2.max_asks >= 1, "containment consumed — asks restored");
  console.log("✓ confusion feedback → one-turn containment then restore");
}

// Compose — no caregiver-visible score or feedback jargon
{
  resetAll();
  const careKey = "cg_compose_no_score";
  setFeedbackContainmentFromFeedback({
    careKey,
    feedback: { helpful_yes_no: false, reduced_confusion_yes_no: false },
  });
  const text = "Mom fell yesterday. We went to urgent care.";
  const turn = ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: text,
    kind: classifyCareEventKind(text),
  });
  const composed = composeCaregiverResponse({
    turn,
    latestRawText: text,
    kind: classifyCareEventKind(text),
  });
  const blob = [
    composed.confirmation,
    composed.what_matters_now ?? "",
    ...composed.still_unclear,
  ].join("\n");
  assert.ok(!/trust score|confidence score|helpful_feedback|feedback score/i.test(blob));
  assert.ok(!/i'?m here for you|thank you for your feedback/i.test(blob));
  console.log("✓ compose output has no caregiver-visible score or empathy templates");
}

// Source — feedback route wires containment when care_key present
{
  const feedbackRoute = fs.readFileSync(path.join(root, "src/app/api/feedback/route.ts"), "utf8");
  const server = fs.readFileSync(path.join(root, "src/lib/telemetry-persistence/server.ts"), "utf8");
  assert.ok(server.includes("setFeedbackContainmentFromFeedback"), "server sets containment");
  assert.ok(fs.existsSync(path.join(root, "src/lib/telemetry-persistence/feedback-containment.ts")));
  assert.ok(!/personalization|engagement_optimization|copy template/i.test(feedbackRoute));
  console.log("✓ feedback API wired to containment module");
}

console.log("\nverify:feedback-containment OK");
