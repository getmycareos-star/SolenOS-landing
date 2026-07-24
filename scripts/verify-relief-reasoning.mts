/**
 * Relief reasoning upgrade — Response Contract orientation from care reality.
 * Soft-only = gather (G1). Orientable care = full relief fields. No meta. No ask-echo as matters.
 */
import assert from "node:assert/strict";
import {
  ingestActiveCareObservation,
  resetActiveCareSituationStore,
} from "../src/lib/active-care-situation";
import { resetCareRealityStateStore } from "../src/lib/care-reality-state";
import { resetCareEpistemicsStores } from "../src/lib/care-epistemics";
import { resetCareRecipientIdentityStore } from "../src/lib/care-recipient-identity";
import { classifyCareEventKind, buildLivingCareRecordResponse } from "../src/lib/living-care-record-ux";
import { composeCaregiverResponse } from "../src/lib/caregiver-response-composer";
import { decideReliefDisclosure } from "../src/lib/response-contract/relief-decision";
import { mergeReliefIntoDisclosurePlan } from "../src/lib/response-contract/disclosure-merge";
import { buildDisclosurePlan } from "../src/lib/care-reality-state/disclosure";
import { processSituationInput } from "../src/lib/situation-entry/pipeline";

function resetAll() {
  resetActiveCareSituationStore();
  resetCareRealityStateStore();
  resetCareEpistemicsStores();
  resetCareRecipientIdentityStore();
}

console.log("=== Relief reasoning upgrade ===\n");

{
  const soft = decideReliefDisclosure({
    turnClass: "observation",
    softVague: true,
    understandingSufficient: false,
    careContextGapsRemain: true,
    careWorthyCount: 1,
  });
  assert.equal(soft.mode, "soft_gather");
  assert.equal(soft.show_clarity, false);
  assert.equal(soft.show_asks, true);
  console.log("✓ decision: soft_gather");
}

{
  const orient = decideReliefDisclosure({
    turnClass: "observation",
    softVague: false,
    understandingSufficient: true,
    careContextGapsRemain: true,
    careWorthyCount: 1,
  });
  assert.equal(orient.mode, "orient_with_gaps");
  assert.equal(orient.show_clarity, true);
  assert.equal(orient.show_asks, true);
  assert.equal(orient.show_follow_up, true);
  console.log("✓ decision: orient_with_gaps");
}

{
  const metaAfterCare = decideReliefDisclosure({
    turnClass: "observation",
    softVague: false,
    understandingSufficient: true,
    careContextGapsRemain: false,
    careWorthyCount: 2,
    latestIsCareWorthy: false,
    latestRawText:
      "hi solenos, this is my first time here, i just got recommended that youd help me",
  });
  assert.equal(metaAfterCare.mode, "product_meta_turn");
  assert.equal(metaAfterCare.show_clarity, false);
  console.log("✓ decision: product_meta_turn (meta after prior care)");
}

{
  const awaiting = decideReliefDisclosure({
    turnClass: "observation",
    softVague: false,
    understandingSufficient: false,
    careContextGapsRemain: true,
    careWorthyCount: 0,
  });
  assert.equal(awaiting.mode, "awaiting_care_evidence");
  assert.equal(awaiting.show_clarity, false);
  assert.equal(awaiting.show_asks, true);
  console.log("✓ decision: awaiting_care_evidence (no care anchors)");
}

{
  resetAll();
  const careKey = `meta_only_${Date.now().toString(36)}`;
  const META =
    "hi solenos, this is my first time here, i just got recommended that youd help me know what matters from my messy care";
  const turn = ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: META,
    kind: classifyCareEventKind(META),
    nowIso: "2026-07-20T05:00:00.000Z",
  });
  const composed = composeCaregiverResponse({
    turn,
    latestRawText: META,
    kind: classifyCareEventKind(META),
  });
  assert.equal(composed.show_clarity, false);
  assert.equal(composed.care_story_update, null);
  assert.ok(/nothing about.*care is held yet/i.test(composed.confirmation));
  assert.ok(
    !/added to the care story|beginning of the living care record/i.test(
      `${composed.confirmation} ${composed.care_story_update ?? ""}`,
    ),
  );
  console.log("✓ meta-only: invite only, no care-story chrome");
}

{
  resetAll();
  const careKey = `meta_after_${Date.now().toString(36)}`;
  const REAL = "he also has been talking to himself";
  const META =
    "hi solenos, this is my first time here, i just got recommended that youd help me know what matters from my messy care";
  ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: REAL,
    kind: classifyCareEventKind(REAL),
    nowIso: "2026-07-20T04:00:00.000Z",
  });
  const turn = ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: META,
    kind: classifyCareEventKind(META),
    nowIso: "2026-07-20T04:05:00.000Z",
  });
  const composed = composeCaregiverResponse({
    turn,
    latestRawText: META,
    kind: classifyCareEventKind(META),
  });
  assert.equal(composed.show_clarity, false);
  assert.equal(composed.care_story_update, null);
  assert.ok(/about using solenos/i.test(composed.confirmation));
  assert.ok(
    !/added to the care story|beginning of the living care record/i.test(
      `${composed.confirmation} ${composed.care_story_update ?? ""}`,
    ),
  );
  console.log("✓ meta after prior care: no new care-story chrome");
}

{
  resetAll();
  const careKey = `relief_${Date.now().toString(36)}`;
  const REAL = "he also has been talking to himself";
  const turn = ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: REAL,
    kind: classifyCareEventKind(REAL),
    nowIso: "2026-07-20T03:00:00.000Z",
  });
  const composed = composeCaregiverResponse({
    turn,
    latestRawText: REAL,
    kind: classifyCareEventKind(REAL),
  });
  assert.equal(composed.show_clarity, true, "orientable → Clarity");
  assert.ok(composed.situation_summary || composed.what_we_know.length > 0, "what is happening");
  assert.ok(composed.what_matters_now, "what matters");
  assert.ok(composed.what_can_wait, "what can wait");
  assert.ok(composed.still_unclear.length >= 1, "what to ask");
  assert.ok(composed.follow_up_items.length >= 1, "follow-up");
  const matters = composed.what_matters_now!.toLowerCase();
  const ask = (composed.still_unclear[0] ?? "").toLowerCase();
  assert.ok(!matters.includes(ask.slice(0, 20)), "matters must not echo ask");
  assert.ok(
    !/hi solenos|first time here|messy care/i.test(
      [composed.confirmation, composed.connection_note, ...composed.what_we_know].join(" "),
    ),
    "no meta",
  );
  console.log("composer relief OK:");
  console.log(`  happening: ${composed.situation_summary ?? composed.what_we_know[0]}`);
  console.log(`  matters: ${composed.what_matters_now}`);
  console.log(`  can_wait: ${composed.what_can_wait}`);
  console.log(`  ask: ${composed.still_unclear[0]}`);
  console.log(`  follow_up: ${composed.follow_up_items.join(" · ")}`);
}

{
  resetAll();
  const careKey = `soft_${Date.now().toString(36)}`;
  const SOFT = "shes not feeling well and im confused";
  const turn = ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: SOFT,
    kind: classifyCareEventKind(SOFT),
    nowIso: "2026-07-20T03:10:00.000Z",
  });
  const composed = composeCaregiverResponse({
    turn,
    latestRawText: SOFT,
    kind: classifyCareEventKind(SOFT),
  });
  assert.equal(composed.show_clarity, false, "G1 soft → no Clarity");
  assert.equal(composed.what_matters_now, null);
  assert.ok(composed.still_unclear.length <= 1, "soft: ≤1 ask");
  console.log("✓ G1 soft_gather preserved");
}

{
  resetAll();
  const careKey = `pipe_relief_${Date.now().toString(36)}`;
  const META =
    "hi solenos, this is my first time here, i just got recommended that youd help me know what matters from my messy care";
  const REAL = "he also has been talking to himself";
  await processSituationInput({
    raw_input: META,
    caregiver_id: careKey,
    timestamp: "2026-07-20T04:00:00.000Z",
  });
  const res = await processSituationInput({
    raw_input: REAL,
    caregiver_id: careKey,
    timestamp: "2026-07-20T04:05:00.000Z",
  });
  const view = buildLivingCareRecordResponse({ response: res, rawInput: REAL });
  assert.equal(view.show_attention_sections, true);
  assert.ok(view.what_matters_now);
  assert.ok(view.what_can_wait);
  assert.ok(view.what_needs_context.length >= 1);
  assert.ok(view.follow_up_items.length >= 1);
  const blob = [
    view.recognition_line,
    view.care_event_added.confirmation,
    view.connection_note,
    ...(view.what_understood ?? []),
    view.evidence_line,
  ].join("\n");
  assert.ok(!/hi solenos|first time here|messy care/i.test(blob));
  console.log("✓ pipeline LCR relief free of meta");
}

{
  const crsGrowing = buildDisclosurePlan("growing");
  assert.equal(crsGrowing.show_what_matters_now, true, "CRS growing unlocks Clarity by stage");
  const softRelief = decideReliefDisclosure({
    turnClass: "observation",
    softVague: true,
    understandingSufficient: false,
    careContextGapsRemain: true,
    careWorthyCount: 1,
  });
  const merged = mergeReliefIntoDisclosurePlan({
    crsPlan: crsGrowing,
    relief: softRelief,
    composed: {
      show_clarity: false,
      show_questions: true,
      still_unclear_count: 1,
      what_we_know_count: 1,
      has_situation_summary: false,
      has_what_changed: false,
      observation_count: 1,
    },
  });
  assert.equal(merged.show_what_matters_now, false, "dual-authority: relief wins Clarity");
  assert.equal(merged.show_questions, true, "relief still allows asks");
  assert.ok(merged.max_questions >= 1, "max_questions from relief merge");
  console.log("✓ dual-authority: CRS growing cannot override soft_gather");
}

console.log("\n=== Relief reasoning upgrade passed ===\n");
