/**
 * Live smoke: G34 familiarity baseline + risk→attention (no scores).
 * Run: npx tsx scripts/smoke-g34-risk-attention.mts
 */
import assert from "node:assert/strict";
import {
  ingestActiveCareObservation,
  resetActiveCareSituationStore,
} from "../src/lib/active-care-situation";
import { resetCareRealityStateStore } from "../src/lib/care-reality-state";
import {
  listFamiliarityBaseline,
  resetCareEpistemicsStores,
} from "../src/lib/care-epistemics";
import { resetCareRecipientIdentityStore } from "../src/lib/care-recipient-identity";
import { resetMultiCaregiverContextStore } from "../src/lib/multi-caregiver-context-model";
import {
  classifyCareEventKind,
  buildLivingCareRecordResponse,
} from "../src/lib/living-care-record-ux";
import { composeCaregiverResponse } from "../src/lib/caregiver-response-composer";
import {
  humanAttentionLabelFor,
  containsAttentionScoreTheater,
} from "../src/lib/response-intelligence";
import { processSituationInput } from "../src/lib/situation-entry/pipeline";

function resetAll() {
  resetActiveCareSituationStore();
  resetCareRealityStateStore();
  resetCareEpistemicsStores();
  resetCareRecipientIdentityStore();
  resetMultiCaregiverContextStore();
}

console.log("=== Smoke: G34 + risk→attention ===\n");

// ——— G34 ———
{
  resetAll();
  const careKey = `smoke_g34_${Date.now().toString(36)}`;
  const baseline = "He normally walks to the corner store after lunch.";
  ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: baseline,
    kind: classifyCareEventKind(baseline),
    nowIso: "2026-07-01T08:00:00.000Z",
  });
  const stored = listFamiliarityBaseline(careKey);
  assert.ok(stored.length >= 1, "G34: baseline stored under contributor lookup");
  console.log("G34 store OK:");
  console.log(`  facts: ${stored.length}`);
  console.log(`  statement: ${stored[0]!.statement}`);

  const change = "Today he stayed in the chair all afternoon.";
  const turn = ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: change,
    kind: classifyCareEventKind(change),
    nowIso: "2026-07-17T14:00:00.000Z",
  });
  assert.ok(
    turn.what_changed_in_understanding &&
      /usual pattern|differ from/i.test(turn.what_changed_in_understanding),
    "G34: change vs their usual",
  );
  const composed = composeCaregiverResponse({
    turn,
    latestRawText: change,
    kind: classifyCareEventKind(change),
  });
  const blob = [composed.confirmation, composed.what_changed ?? "", composed.recognition_line ?? ""].join(
    " ",
  );
  assert.ok(!/dementia progression|normal dementia|typical dementia/i.test(blob));
  console.log("G34 change OK:");
  console.log(`  what_changed: ${turn.what_changed_in_understanding}`);
  console.log(`  recognition: ${composed.recognition_line}`);
  console.log(`  care_story: ${composed.care_story_update}`);
  console.log(`  risk (engine): ${composed.contract_output.risk_level}`);
  console.log();
}

// ——— Risk → attention (soft early = quiet low) ———
{
  resetAll();
  const careKey = `smoke_risk_soft_${Date.now().toString(36)}`;
  const text = "Mom seems a bit quieter today.";
  const res = await processSituationInput({
    raw_input: text,
    caregiver_id: careKey,
    timestamp: "2026-07-19T18:00:00.000Z",
  });
  const view = buildLivingCareRecordResponse({ response: res, rawInput: text });
  assert.ok(["low", "medium", "high"].includes(view.risk_level));
  assert.ok(!containsAttentionScoreTheater(view.attention_label ?? ""));
  assert.ok(!/\d\s*%/.test(view.attention_label ?? ""));
  assert.ok(!/risk_level/i.test(view.attention_label ?? ""));
  console.log("Soft note attention:");
  console.log(`  stage: ${view.disclosure_stage}`);
  console.log(`  risk_level (engine): ${view.risk_level}`);
  console.log(`  attention_label: ${view.attention_label ?? "(quiet — not disclosed)"}`);
  console.log(`  show_attention_level: ${view.disclosure_plan.show_attention_level}`);
  if (view.risk_level === "low" && view.disclosure_stage === "early") {
    assert.equal(view.attention_label, null, "low+early stays quiet");
    assert.equal(view.disclosure_plan.show_attention_level, false);
  }
  console.log();
}

// ——— Risk → attention (fall = medium+, disclosed) ———
{
  resetAll();
  const careKey = `smoke_risk_fall_${Date.now().toString(36)}`;
  const text = "Dad fell in the bathroom this morning.";
  const res = await processSituationInput({
    raw_input: text,
    caregiver_id: careKey,
    timestamp: "2026-07-19T18:05:00.000Z",
  });
  const view = buildLivingCareRecordResponse({ response: res, rawInput: text });
  assert.ok(view.risk_level === "medium" || view.risk_level === "high");
  assert.ok(view.attention_label?.trim(), "fall discloses attention");
  assert.equal(view.disclosure_plan.show_attention_level, true);
  assert.equal(view.attention_label, humanAttentionLabelFor(view.risk_level));
  assert.ok(!containsAttentionScoreTheater(view.attention_label!));
  console.log("Fall note attention:");
  console.log(`  stage: ${view.disclosure_stage}`);
  console.log(`  risk_level (engine): ${view.risk_level}`);
  console.log(`  attention_label: ${view.attention_label}`);
  console.log(`  recognition: ${view.recognition_line}`);
  console.log(`  confirmation: ${view.care_event_added.confirmation}`);
  console.log();
}

console.log("=== Smoke passed: G34 + risk→attention ===\n");
