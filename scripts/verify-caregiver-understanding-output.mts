/**
 * Caregiver understanding output — not document summarizer.
 * SoT: docs/02-product/solenos-communicate-understanding.md
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  CAREGIVER_UNDERSTANDING_OUTPUT_PURPOSE,
  CAREGIVER_UNDERSTANDING_FIELDS,
  DOCUMENT_SUMMARIZER_THEATER,
  UNDERSTANDING_NOT_SUMMARY_ASK,
  containsDocumentSummarizerTheater,
  evaluateCaregiverUnderstandingOutput,
} from "../src/lib/caregiver-understanding-output";
import {
  ingestActiveCareObservation,
  resetActiveCareSituationStore,
} from "../src/lib/active-care-situation";
import { resetCareRealityStateStore } from "../src/lib/care-reality-state";
import { composeCaregiverResponse } from "../src/lib/caregiver-response-composer";
import { classifyCareEventKind } from "../src/lib/living-care-record-ux";
import { resetMultiCaregiverContextStore } from "../src/lib/multi-caregiver-context-model";
import { resetCareEpistemicsStores } from "../src/lib/care-epistemics";
import { resetCareRecipientIdentityStore } from "../src/lib/care-recipient-identity";
import { resetDecisionMemoryStore } from "../src/lib/decision-memory";

const root = process.cwd();

function resetAll() {
  resetActiveCareSituationStore();
  resetCareRealityStateStore();
  resetMultiCaregiverContextStore();
  resetCareEpistemicsStores();
  resetCareRecipientIdentityStore();
  resetDecisionMemoryStore();
}

console.log("=== Caregiver Understanding Output ===\n");
console.log(CAREGIVER_UNDERSTANDING_OUTPUT_PURPOSE);

assert.equal(CAREGIVER_UNDERSTANDING_FIELDS.length, 5);
assert.ok(/change about our understanding/i.test(UNDERSTANDING_NOT_SUMMARY_ASK));
assert.ok(
  containsDocumentSummarizerTheater(
    "Here is a summary of your document: Patient discharged.",
  ),
);
assert.ok(DOCUMENT_SUMMARIZER_THEATER.length >= 5);
console.log("✓ understanding fields + summarizer theater detection");

{
  // Bad composed shape — summary theater must fail evaluation
  const bad = {
    recognition_line: null,
    confirmation: "Here is a summary of your document.",
    what_matters_now: null,
    what_can_wait: null,
    what_may_become_serious: null,
    what_changed: null,
    connection_note: null,
    what_we_know: ["Patient discharged from hospital."],
    situation_summary: null,
    still_unclear: [] as string[],
    care_story_update: null,
    is_improvement: false,
    show_clarity: false,
    show_questions: false,
    why_asking: null,
    evidence_line: null,
    evidence_maturity: 1 as const,
    follow_up_items: [] as string[],
  };
  const evalBad = evaluateCaregiverUnderstandingOutput(bad);
  assert.ok(!evalBad.passed, "summarizer confirmation must fail");
  console.log("✓ rejects document-summary confirmation");
}

{
  resetAll();
  // Novel discharge-style input — must produce understanding, not summary theater
  const text =
    "She came home from the hospital. They stopped one of her medicines and said to see neurology.";
  const turn = ingestActiveCareObservation({
    caregiverId: "cg_und_doc",
    rawText: text,
    kind: classifyCareEventKind(text),
    nowIso: "2026-07-22T15:00:00.000Z",
  });
  const composed = composeCaregiverResponse({
    turn,
    latestRawText: text,
    kind: classifyCareEventKind(text),
  });
  const blob = [
    composed.recognition_line,
    composed.confirmation,
    composed.situation_summary,
    ...(composed.what_we_know ?? []),
    composed.what_changed,
    composed.what_matters_now,
    ...(composed.still_unclear ?? []),
    composed.care_story_update,
  ]
    .filter(Boolean)
    .join("\n");
  assert.ok(!containsDocumentSummarizerTheater(blob), `summarizer theater in: ${blob}`);
  assert.ok(
    !/here is a summary|document summary|key points from/i.test(blob),
  );
  const evalOk = evaluateCaregiverUnderstandingOutput(composed);
  assert.ok(evalOk.passed, evalOk.failures.join("; "));
  const hasOrient =
    (composed.what_we_know?.length ?? 0) > 0 ||
    Boolean(composed.situation_summary) ||
    Boolean(composed.recognition_line);
  assert.ok(hasOrient, "must orient with understanding substance");
  console.log("✓ discharge-style input → understanding, not summary");
}

{
  resetAll();
  // Second turn — change/connection expected for returning care record
  const careKey = "cg_und_ret";
  ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: "She walked around the house without help.",
    kind: classifyCareEventKind("She walked around the house without help."),
    nowIso: "2026-07-22T10:00:00.000Z",
  });
  const t2 = "After the tumble she does not want to walk far.";
  const turn2 = ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: t2,
    kind: classifyCareEventKind(t2),
    nowIso: "2026-07-22T12:00:00.000Z",
  });
  const composed = composeCaregiverResponse({
    turn: turn2,
    latestRawText: t2,
    kind: classifyCareEventKind(t2),
  });
  const hasChangeOrConnect =
    Boolean(composed.what_changed?.trim()) ||
    Boolean(composed.connection_note?.trim()) ||
    composed.what_we_know.some((l) => /already held|connects|new:/i.test(l));
  assert.ok(hasChangeOrConnect, "returning care record must show change/connection");
  assert.ok(evaluateCaregiverUnderstandingOutput(composed).passed);
  console.log("✓ returning care record → change/connection, not isolated summary");
}

{
  const sot = path.join(root, "docs/02-product/solenos-communicate-understanding.md");
  assert.ok(fs.existsSync(sot));
  const body = fs.readFileSync(sot, "utf8");
  assert.ok(/not.*summariz/i.test(body));
  assert.ok(/Care Reality/i.test(body));
  const rule = path.join(root, ".cursor/rules/solenos-communicate-understanding.mdc");
  assert.ok(fs.existsSync(rule));
  const gate = fs.readFileSync(
    path.join(root, "src/lib/response-acceptance-gate/index.ts"),
    "utf8",
  );
  assert.ok(gate.includes("containsDocumentSummarizerTheater"));
  assert.ok(gate.includes("evaluateCaregiverUnderstandingOutput"));
  console.log("✓ SoT + rule + gate wired");
}

console.log("\n=== Caregiver Understanding Output: all checks passed ===\n");
