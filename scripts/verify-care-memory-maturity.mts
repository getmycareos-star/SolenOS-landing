/**
 * Care memory maturity — first vs returning Care Reality.
 * SoT: docs/02-product/solenos-first-vs-returning-user.md
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  CARE_MEMORY_MATURITY_PURPOSE,
  classifyCareMemoryState,
  composeMemoryAwareSoftSummary,
  composeMemoryAwareWhatChanged,
  composeNewCareRealityConfirmation,
  composeReturningCareRealityConfirmation,
  composeReturningOrientationLines,
  containsFakeContinuity,
  containsCareStoryChrome,
  resolveCareTurnConfirmation,
  caregiverNoteMetaLabel,
  isNewCareReality,
} from "../src/lib/care-memory-maturity";
import {
  ingestActiveCareObservation,
  resetActiveCareSituationStore,
} from "../src/lib/active-care-situation";
import { resetCareRealityStateStore } from "../src/lib/care-reality-state";
import { composeCaregiverResponse } from "../src/lib/caregiver-response-composer";
import { classifyCareEventKind, buildLivingCareRecordResponse } from "../src/lib/living-care-record-ux";
import { resetCareContextRootStore, processSituationInput } from "../src/lib/situation-entry";
import { resetCareEventStore } from "../src/lib/care-events/store";
import { resetDareStore } from "../src/lib/data-acquisition-resilience";
import { resetNormalizationStore } from "../src/lib/event-normalization/event-normalizer";
import { resetPolicyEngineStore, seedVerifyConsent } from "../src/lib/policy-engine";
import { resetDecisionMemoryStore } from "../src/lib/decision-memory";
import { resetMultiCaregiverContextStore } from "../src/lib/multi-caregiver-context-model";
import { resetCareEpistemicsStores } from "../src/lib/care-epistemics";
import { resetCareRecipientIdentityStore } from "../src/lib/care-recipient-identity";

const root = process.cwd();

function resetAll() {
  resetActiveCareSituationStore();
  resetCareRealityStateStore();
  resetDecisionMemoryStore();
  resetMultiCaregiverContextStore();
  resetCareEpistemicsStores();
  resetCareRecipientIdentityStore();
}

console.log("=== Care Memory Maturity (First vs Returning) ===\n");
console.log(CARE_MEMORY_MATURITY_PURPOSE);

assert.equal(
  classifyCareMemoryState({ observationCount: 1, crsRevision: 1 }),
  "new_care_reality",
);
assert.equal(
  classifyCareMemoryState({ observationCount: 2, crsRevision: 1 }),
  "returning_care_reality",
);
assert.equal(isNewCareReality({ observationCount: 1 }), true);
assert.equal(isNewCareReality({ observationCount: 3 }), false);
console.log("✓ classify new vs returning from memory depth");

{
  const softNew = composeMemoryAwareSoftSummary({ state: "new_care_reality" });
  assert.ok(/Beginning to understand/i.test(softNew));
  assert.ok(!containsFakeContinuity(softNew));

  const softRet = composeMemoryAwareSoftSummary({ state: "returning_care_reality" });
  assert.ok(/already held|care story/i.test(softRet));

  const changedNew = composeMemoryAwareWhatChanged({ state: "new_care_reality" });
  assert.ok(/First care observations/i.test(changedNew));
  assert.ok(!containsFakeContinuity(changedNew));

  const confNew = composeNewCareRealityConfirmation({ subjectLabel: null });
  assert.ok(/Beginning of the Living Care Record/i.test(confNew));
  assert.ok(/reconstruct/i.test(confNew));

  const confRet = composeReturningCareRealityConfirmation({ subjectLabel: null });
  assert.ok(/Updated the Living Care Record/i.test(confRet));
  assert.ok(/already held/i.test(confRet));
  console.log("✓ orientation copy differs by state");
}

{
  const lines = composeReturningOrientationLines({
    priorFacts: ["Repeated questions in the morning."],
    latestFacts: ["Repeated questions before breakfast again."],
  });
  assert.ok(lines.already_known.length >= 1);
  assert.ok(lines.what_is_new.length >= 1);
  console.log("✓ returning already-known vs new");
}

{
  resetAll();
  const text =
    "She keeps asking the same questions. I don't know if something is changing.";
  const turn = ingestActiveCareObservation({
    caregiverId: "cg_memory_new",
    rawText: text,
    kind: classifyCareEventKind(text),
    nowIso: "2026-07-19T19:00:00.000Z",
  });
  const composed = composeCaregiverResponse({
    turn,
    latestRawText: text,
    kind: classifyCareEventKind(text),
  });
  assert.ok(
    /Beginning of/i.test(composed.confirmation),
    "first capture begins care reality",
  );
  assert.ok(!containsFakeContinuity(composed.confirmation));
  const blob = [
    composed.confirmation,
    composed.situation_summary,
    composed.what_changed,
    ...(composed.what_we_know ?? []),
  ]
    .filter(Boolean)
    .join(" ");
  assert.ok(!containsFakeContinuity(blob), "new user: no fake continuity");
  assert.equal(composed.show_connection, false, "new user: composer withholds connection");
  console.log("✓ composer — new care reality (no fake continuity)");
}

{
  resetAll();
  const t1 = "She repeated the same question several times this morning.";
  const turn1 = ingestActiveCareObservation({
    caregiverId: "cg_memory_ret",
    rawText: t1,
    kind: classifyCareEventKind(t1),
    nowIso: "2026-07-19T10:00:00.000Z",
  });
  void turn1;
  const t2 = "She asked the same questions again before lunch — my brother only sees her on weekends.";
  const turn2 = ingestActiveCareObservation({
    caregiverId: "cg_memory_ret",
    rawText: t2,
    kind: classifyCareEventKind(t2),
    nowIso: "2026-07-19T12:00:00.000Z",
  });
  const composed = composeCaregiverResponse({
    turn: turn2,
    latestRawText: t2,
    kind: classifyCareEventKind(t2),
  });
  assert.ok(/Updated|connected|already held|Living Care Record/i.test(composed.confirmation),
    "returning continues care reality",
  );
  assert.ok(!/Beginning of/i.test(composed.confirmation), "not first-begin language");
  console.log("✓ composer — returning care reality");
}

{
  resetAll();
  resetCareContextRootStore();
  resetCareEventStore();
  resetDareStore();
  resetNormalizationStore();
  resetPolicyEngineStore();
  seedVerifyConsent("cg_memory_panel");

  const first = await processSituationInput({
    raw_input: "She keeps asking the same questions.",
    caregiver_id: "cg_memory_panel",
    timestamp: "2026-07-19T10:00:00.000Z",
  });
  const viewNew = buildLivingCareRecordResponse({
    response: first,
    rawInput: "She keeps asking the same questions.",
  });
  assert.equal(viewNew.disclosure_plan.show_connection, false, "LCR new: plan gates connection");
  assert.equal(viewNew.connection_note, null, "LCR new: no connection_note leak");

  const second = await processSituationInput({
    raw_input:
      "She asked the same questions again before lunch — my brother only sees her on weekends.",
    caregiver_id: "cg_memory_panel",
    timestamp: "2026-07-19T12:00:00.000Z",
  });
  const viewRet = buildLivingCareRecordResponse({
    response: second,
    rawInput:
      "She asked the same questions again before lunch — my brother only sees her on weekends.",
  });
  const panel = fs.readFileSync(
    path.join(root, "src/components/mvp-workspace/LivingCareRecordPanel.tsx"),
    "utf8",
  );
  assert.ok(panel.includes("plan.show_connection"));
  assert.ok(!/connection_note && view\.observation_count/.test(panel));
  if (viewRet.disclosure_plan.show_connection) {
    assert.ok(viewRet.connection_note?.trim(), "returning: connection copy when plan allows");
  }
  console.log("✓ LCR panel — connection gated by composer disclosure plan");
}

{
  assert.equal(
    caregiverNoteMetaLabel({ careWorthyCount: 0, latestIsCareWorthy: false }),
    "Waiting for care to share",
  );
  assert.equal(
    caregiverNoteMetaLabel({ careWorthyCount: 1, latestIsCareWorthy: true }),
    "Added to the care story",
  );
  assert.equal(
    caregiverNoteMetaLabel({ careWorthyCount: 2, latestIsCareWorthy: false }),
    "About SolenOS — what you shared stays in the care story",
  );
  assert.ok(
    containsCareStoryChrome("Added to the care story already underway"),
    "chrome detector",
  );
  assert.ok(
    !containsCareStoryChrome("Nothing about the person's care is held yet."),
    "invite is not chrome",
  );
  const metaConf = resolveCareTurnConfirmation({
    turnClass: "observation",
    subjectLabel: null,
    careWorthyCount: 0,
    latestIsCareWorthy: false,
    hasCareEvidence: false,
    isNewCareReality: true,
    gatheringContext: false,
    priorObservationFactsCount: 0,
    continuitySymptom: false,
    improvement: false,
    hasDocuments: false,
    kind: "general",
    latestRawText: "hi solenos first time here",
  });
  assert.ok(/nothing about.*care is held yet/i.test(metaConf));
  assert.ok(!containsCareStoryChrome(metaConf));
  console.log("✓ confirmation gate + note meta label");
}

{
  const sot = path.join(root, "docs/02-product/solenos-first-vs-returning-user.md");
  assert.ok(fs.existsSync(sot), "SoT exists");
  const rule = path.join(root, ".cursor/rules/solenos-first-vs-returning-user.mdc");
  assert.ok(fs.existsSync(rule), "Cursor rule exists");
  const mod = fs.readFileSync(
    path.join(root, "src/lib/care-memory-maturity/index.ts"),
    "utf8",
  );
  assert.ok(!/\bJennifer\b/.test(mod), "no scenario hardcoding");
  console.log("✓ SoT + rule + no hardcoding");
}

console.log("\n=== Care Memory Maturity: all checks passed ===\n");
