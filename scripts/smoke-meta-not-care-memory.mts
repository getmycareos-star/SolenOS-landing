/**
 * Meta/greeting must never become care memory; real observation must not fake-connect to it.
 */
import assert from "node:assert/strict";
import {
  ingestActiveCareObservation,
  resetActiveCareSituationStore,
} from "../src/lib/active-care-situation";
import { resetCareRealityStateStore } from "../src/lib/care-reality-state";
import {
  isCareRealityAnchorText,
  isProductSessionMetaText,
  resetCareEpistemicsStores,
} from "../src/lib/care-epistemics";
import { resetCareRecipientIdentityStore } from "../src/lib/care-recipient-identity";
import { resetMultiCaregiverContextStore } from "../src/lib/multi-caregiver-context-model";
import { classifyCareEventKind } from "../src/lib/living-care-record-ux";
import { composeCaregiverResponse } from "../src/lib/caregiver-response-composer";
import { buildLivingCareRecordResponse } from "../src/lib/living-care-record-ux";
import { processSituationInput } from "../src/lib/situation-entry/pipeline";

function resetAll() {
  resetActiveCareSituationStore();
  resetCareRealityStateStore();
  resetCareEpistemicsStores();
  resetCareRecipientIdentityStore();
  resetMultiCaregiverContextStore();
}

const META =
  "hi solenos, this is my first time here, i just got recommended that youd help me know what matters from my messy care";
const REAL = "he also has been talking to himself";

console.log("=== Meta must not become care memory ===\n");

assert.equal(isProductSessionMetaText(META), true);
assert.equal(isCareRealityAnchorText(META), false);
assert.equal(isCareRealityAnchorText(REAL), true);
console.log("✓ classifiers: meta vs real observation");

{
  resetAll();
  const careKey = `meta_fix_${Date.now().toString(36)}`;
  ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: META,
    kind: classifyCareEventKind(META),
    nowIso: "2026-07-20T01:00:00.000Z",
  });
  const turn = ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: REAL,
    kind: classifyCareEventKind(REAL),
    nowIso: "2026-07-20T01:05:00.000Z",
  });
  const composed = composeCaregiverResponse({
    turn,
    latestRawText: REAL,
    kind: classifyCareEventKind(REAL),
  });
  const blob = [
    composed.confirmation,
    composed.connection_note ?? "",
    composed.what_changed ?? "",
    ...(composed.what_we_know ?? []),
    composed.evidence_line ?? "",
    composed.care_story_update ?? "",
  ].join("\n");
  assert.ok(!/first time here/i.test(blob), "must not cite first-time meta");
  assert.ok(!/hi solenos/i.test(blob), "must not cite hi solenos as care memory");
  assert.ok(!/messy care/i.test(blob), "must not cite product pitch as held fact");
  assert.ok(
    !composed.connection_note || !/first time|hi solenos|messy care/i.test(composed.connection_note),
    "connection must not glue to meta",
  );
  assert.ok(
    composed.what_we_know.some((l) => /talking to (him|her|them)?self/i.test(l)) ||
      /talking to himself/i.test(composed.recognition_line ?? ""),
    "real observation must surface",
  );
  assert.equal(composed.show_clarity, true, "orientable care → Response Contract relief");
  assert.ok(composed.what_matters_now, "what matters now");
  assert.ok(composed.what_can_wait, "what can wait");
  assert.ok(composed.still_unclear.length >= 1, "what to ask next");
  assert.ok(composed.follow_up_items.length >= 1, "follow-up continuity");
  assert.ok(
    !/Updated the Living Care Record — connected to what is already held/i.test(
      composed.confirmation,
    ),
    "must not fake returning continuity from meta",
  );
  console.log("composer OK:");
  console.log(`  recognition: ${composed.recognition_line}`);
  console.log(`  confirmation: ${composed.confirmation}`);
  console.log(`  connection: ${composed.connection_note}`);
  console.log(`  what_we_know: ${JSON.stringify(composed.what_we_know)}`);
  console.log(`  what_matters: ${composed.what_matters_now}`);
  console.log(`  what_can_wait: ${composed.what_can_wait}`);
  console.log(`  asks: ${JSON.stringify(composed.still_unclear)}`);
  console.log(`  follow_up: ${JSON.stringify(composed.follow_up_items)}`);
  console.log(`  care_story: ${composed.care_story_update}`);
}

{
  resetAll();
  const careKey = `meta_pipe_${Date.now().toString(36)}`;
  await processSituationInput({
    raw_input: META,
    caregiver_id: careKey,
    timestamp: "2026-07-20T02:00:00.000Z",
  });
  const res = await processSituationInput({
    raw_input: REAL,
    caregiver_id: careKey,
    timestamp: "2026-07-20T02:05:00.000Z",
  });
  const view = buildLivingCareRecordResponse({ response: res, rawInput: REAL });
  const blob = [
    view.recognition_line ?? "",
    view.care_event_added.confirmation,
    view.connection_note ?? "",
    view.what_changed_in_understanding ?? "",
    ...(view.what_understood ?? []),
    view.evidence_line ?? "",
    view.care_story_update ?? "",
  ].join("\n");
  assert.ok(!/hi solenos|first time here|messy care/i.test(blob), "LCR view free of meta");
  assert.ok(/talking to himself/i.test(blob), "LCR shows real observation");
  assert.equal(view.show_attention_sections, true, "Clarity section for relief");
  assert.ok(view.what_matters_now, "what matters in LCR");
  assert.ok(view.what_can_wait, "what can wait in LCR");
  assert.ok(view.what_needs_context.length >= 1, "what to ask in LCR");
  assert.ok(view.follow_up_items.length >= 1, "follow-up in LCR");
  console.log("\nLCR view OK:");
  console.log(`  recognition: ${view.recognition_line}`);
  console.log(`  confirmation: ${view.care_event_added.confirmation}`);
  console.log(`  connection: ${view.connection_note}`);
  console.log(`  understood: ${JSON.stringify(view.what_understood)}`);
  console.log(`  matters: ${view.what_matters_now}`);
  console.log(`  can_wait: ${view.what_can_wait}`);
  console.log(`  asks: ${JSON.stringify(view.what_needs_context)}`);
  console.log(`  follow_up: ${JSON.stringify(view.follow_up_items)}`);
  console.log(`  attention: ${view.attention_label}`);
}

console.log("\n=== Meta → care-memory fix passed ===\n");
