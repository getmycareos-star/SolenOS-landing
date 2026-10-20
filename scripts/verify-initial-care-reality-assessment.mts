/**
 * Initial Care Reality Assessment Mode — Architecture 2B.
 * SoT: docs/02-product/solenos-initial-care-reality-assessment.md
 *
 * Test A: comparable prior → change language
 * Test B: no prior → first understanding, never hallucinate history
 */
import "./_verify-env.mts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  INITIAL_CARE_REALITY_ASSESSMENT_PURPOSE,
  compareAgainstBaseline,
  containsHallucinatedChangeLanguage,
  orientationFromComparisonInitialMode,
} from "../src/lib/care-reality-intelligence";
import {
  ingestActiveCareObservation,
  resetActiveCareSituationStore,
} from "../src/lib/active-care-situation";
import { resetCareRealityStateStore } from "../src/lib/care-reality-state";
import {
  resetMultiCaregiverContextStore,
  resolveCareRealityStoreKey,
} from "../src/lib/multi-caregiver-context-model";
import { resetFamiliarityBaselineStore } from "../src/lib/care-epistemics";
import { composeCaregiverResponse } from "../src/lib/caregiver-response-composer";
import { resetDecisionMemoryStore } from "../src/lib/decision-memory";
import {
  setCareRecipientDisplayName,
  resetCareRecipientIdentityStore,
} from "../src/lib/care-recipient-identity";

console.log("=== Initial Care Reality Assessment (2B) ===\n");
console.log(INITIAL_CARE_REALITY_ASSESSMENT_PURPOSE);

const sot = readFileSync(
  join(process.cwd(), "docs/02-product/solenos-initial-care-reality-assessment.md"),
  "utf8",
);
assert.ok(/Initial Care Reality Assessment/i.test(sot));
assert.ok(/hallucinates history|no comparable prior|must not pretend/i.test(sot));
assert.ok(/Test A|Test B/i.test(sot));
console.log("✓ SoT present");

const sleepMedInput = "Mom has started sleeping more after the medication change.";

{
  // Test A — Existing user with comparable prior
  resetActiveCareSituationStore();
  resetCareRealityStateStore();
  resetMultiCaregiverContextStore();
  resetFamiliarityBaselineStore();
  resetDecisionMemoryStore();
  resetCareRecipientIdentityStore();

  const contributorId = "ica_existing_sleep";
  const careKey = resolveCareRealityStoreKey(contributorId);
  setCareRecipientDisplayName({ careKey, displayName: "Mom" });

  ingestActiveCareObservation({
    caregiverId: contributorId,
    rawText:
      "Mom usually sleeps through the night and stays active during the day.",
    kind: "general",
    nowIso: "2026-07-01T10:00:00.000Z",
  });

  const turn = ingestActiveCareObservation({
    caregiverId: contributorId,
    rawText: sleepMedInput,
    kind: "general",
    nowIso: "2026-07-20T10:00:00.000Z",
  });

  const comparison = compareAgainstBaseline({
    situation: turn.situation,
    latestRawText: sleepMedInput,
    careKey,
    person: "Mom",
    seedFromCapture: true,
  });
  assert.equal(comparison.mode, "change_detection");
  assert.ok(comparison.has_comparable_prior);
  assert.ok(comparison.has_meaningful_change, "change vs prior sleep/activity");

  const composed = composeCaregiverResponse({
    turn,
    latestRawText: sleepMedInput,
    kind: "general",
  });
  const blob = [
    composed.situation_summary ?? "",
    composed.what_changed ?? "",
    ...(composed.what_we_know ?? []),
    composed.confirmation,
  ].join(" ");

  assert.ok(
    /sleep|sleeping/i.test(blob),
    `must mention sleep — got: ${blob.slice(0, 350)}`,
  );
  assert.ok(
    /previous|usual|differ|different from|pattern/i.test(blob),
    `must ground in previous pattern — got: ${blob.slice(0, 350)}`,
  );
  assert.ok(
    /medication|medicine/i.test(blob),
    `must hold medication context — got: ${blob.slice(0, 350)}`,
  );
  console.log("✓ Test A: existing prior → change-from-baseline language");
}

{
  // Test B — New user, same input, no history
  resetActiveCareSituationStore();
  resetCareRealityStateStore();
  resetMultiCaregiverContextStore();
  resetFamiliarityBaselineStore();
  resetDecisionMemoryStore();
  resetCareRecipientIdentityStore();

  const contributorId = "ica_new_sleep";
  const careKey = resolveCareRealityStoreKey(contributorId);
  setCareRecipientDisplayName({ careKey, displayName: "Mom" });

  const turn = ingestActiveCareObservation({
    caregiverId: contributorId,
    rawText: sleepMedInput,
    kind: "general",
    nowIso: "2026-07-20T11:00:00.000Z",
  });

  const comparison = compareAgainstBaseline({
    situation: turn.situation,
    latestRawText: sleepMedInput,
    careKey,
    person: "Mom",
    seedFromCapture: true,
  });
  assert.equal(comparison.mode, "initial_assessment");
  assert.equal(comparison.has_comparable_prior, false);
  assert.equal(comparison.has_meaningful_change, false);
  assert.ok(comparison.current_concerns.length >= 1);

  const orient = orientationFromComparisonInitialMode(comparison);
  assert.ok(orient.current_understanding);
  assert.equal(orient.what_changed, null);
  assert.ok(
    /usual pattern|normal|establish|before/i.test(orient.current_understanding!),
    `must invite baseline — got: ${orient.current_understanding!.slice(0, 300)}`,
  );
  assert.ok(!containsHallucinatedChangeLanguage(orient.current_understanding!));

  const composed = composeCaregiverResponse({
    turn,
    latestRawText: sleepMedInput,
    kind: "general",
  });
  const blob = [
    composed.situation_summary ?? "",
    composed.what_changed ?? "",
    ...(composed.what_we_know ?? []),
    ...(composed.still_unclear ?? []),
    composed.confirmation,
  ].join(" ");

  assert.ok(
    /sleep|sleeping|medication|medicine/i.test(blob),
    `must hold current situation — got: ${blob.slice(0, 400)}`,
  );
  assert.ok(
    /usual|normal|before|establish|whether this represents a change/i.test(blob),
    `must invite establishing usual — got: ${blob.slice(0, 400)}`,
  );
  assert.ok(
    !containsHallucinatedChangeLanguage(blob),
    `must not hallucinate change history — got: ${blob.slice(0, 400)}`,
  );
  assert.ok(
    !/\bgetting worse\b|\bappears to be a decline\b|\bthis is a new behavior\b/i.test(
      blob,
    ),
  );
  console.log("✓ Test B: new user → first understanding, no fake change");
}

{
  // Test C — Returning Care Reality without usual/used-to: graduate out of Initial Assessment
  resetActiveCareSituationStore();
  resetCareRealityStateStore();
  resetMultiCaregiverContextStore();
  resetFamiliarityBaselineStore();
  resetDecisionMemoryStore();
  resetCareRecipientIdentityStore();

  const contributorId = "ica_returning_no_usual";
  const careKey = resolveCareRealityStoreKey(contributorId);
  setCareRecipientDisplayName({ careKey, displayName: "Mom" });

  const first =
    "Mom is not feeling well and I took her to the doctor, she has not been eating or sleeping well lately.";
  ingestActiveCareObservation({
    caregiverId: contributorId,
    rawText: first,
    kind: "general",
    nowIso: "2026-07-22T10:00:00.000Z",
  });

  const second =
    "Mom wasnt feeling good and I took her to the doctor, she came back and refused to eat nor sleep.";
  const turn2 = ingestActiveCareObservation({
    caregiverId: contributorId,
    rawText: second,
    kind: "general",
    nowIso: "2026-07-22T18:00:00.000Z",
  });

  assert.ok(turn2.situation.observations.length >= 2, "prior ACS memory must exist");

  const comparison = compareAgainstBaseline({
    situation: turn2.situation,
    latestRawText: second,
    careKey,
    person: "Mom",
    seedFromCapture: true,
  });
  assert.equal(
    comparison.mode,
    "change_detection",
    "held ACS observations must graduate out of initial_assessment",
  );
  assert.ok(
    comparison.has_comparable_prior,
    "held care memory is a comparable prior for mode selection",
  );

  const composed = composeCaregiverResponse({
    turn: turn2,
    latestRawText: second,
    kind: "general",
  });
  const blob = [
    composed.situation_summary ?? "",
    composed.what_changed ?? "",
    composed.connection_note ?? "",
    ...(composed.what_we_know ?? []),
    ...(composed.still_unclear ?? []),
    composed.confirmation,
  ].join(" ");

  assert.ok(
    !/how they are feeling, a care visit or care moment, and daily patterns that look harder lately/i.test(
      blob,
    ),
    `must not use Initial Assessment filler on returning turn — got: ${blob.slice(0, 450)}`,
  );
  assert.ok(
    !containsHallucinatedChangeLanguage(blob),
    `must not invent decline without usual pattern — got: ${blob.slice(0, 450)}`,
  );
  assert.ok(
    /already held|already underway|related update|connect|related care moment|new observation/i.test(
      blob,
    ),
    `must speak continuing care story — got: ${blob.slice(0, 450)}`,
  );
  console.log("✓ Test C: returning ACS memory → graduate; no Initial Assessment restart");
}

{
  // Test D — CRS memory with fresh ACS session: still graduate (no Initial Assessment restart)
  resetActiveCareSituationStore();
  resetCareRealityStateStore();
  resetMultiCaregiverContextStore();
  resetFamiliarityBaselineStore();
  resetDecisionMemoryStore();
  resetCareRecipientIdentityStore();

  const contributorId = "ica_crs_prior_fresh_acs";
  const careKey = resolveCareRealityStoreKey(contributorId);
  setCareRecipientDisplayName({ careKey, displayName: "Mom" });

  ingestActiveCareObservation({
    caregiverId: contributorId,
    rawText: "Mom is confused after dinner and asked the same question twice.",
    kind: "general",
    nowIso: "2026-07-20T10:00:00.000Z",
  });

  // Simulate Done-for-now: clear ACS only — CRS persists
  resetActiveCareSituationStore();

  const returning =
    "Mom asked where she was this morning and seemed unsettled.";
  const turn = ingestActiveCareObservation({
    caregiverId: contributorId,
    rawText: returning,
    kind: "general",
    nowIso: "2026-07-22T09:00:00.000Z",
  });

  const comparison = compareAgainstBaseline({
    situation: turn.situation,
    latestRawText: returning,
    careKey,
    person: "Mom",
    seedFromCapture: true,
    crs: {
      current_understanding: [
        "Mom is confused after dinner and asked the same question twice.",
      ],
      supporting_evidence: [
        {
          observation: "Mom is confused after dinner and asked the same question twice.",
        },
        {
          observation: "Earlier evening confusion held from prior capture.",
        },
      ],
      observation_count: 2,
      revision: 2,
    },
  });
  assert.equal(
    comparison.mode,
    "change_detection",
    "held CRS memory must graduate out of initial_assessment even when ACS is fresh",
  );
  assert.ok(comparison.has_comparable_prior);

  const composed = composeCaregiverResponse({
    turn,
    latestRawText: returning,
    kind: "general",
  });
  const blob = [
    composed.situation_summary ?? "",
    composed.what_changed ?? "",
    ...(composed.what_we_know ?? []),
    composed.confirmation,
  ].join(" ");
  assert.ok(
    !/how they are feeling, a care visit or care moment, and daily patterns that look harder lately/i.test(
      blob,
    ),
    `must not restart Initial Assessment filler when CRS holds prior — got: ${blob.slice(0, 450)}`,
  );
  assert.ok(
    !containsHallucinatedChangeLanguage(blob),
    `must not invent decline without usual pattern — got: ${blob.slice(0, 450)}`,
  );
  console.log("✓ Test D: CRS prior + fresh ACS → graduate; no Initial Assessment restart");
}

console.log("\nverify:initial-care-reality-assessment OK");
