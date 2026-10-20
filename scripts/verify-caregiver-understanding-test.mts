/**
 * 30-Second Caregiver Understanding Test — midnight gate.
 * SoT: docs/02-product/solenos-caregiver-understanding-test.md
 *
 * Illustration fixtures only — never product if-branches.
 */
import "./_verify-env.mts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CAREGIVER_UNDERSTANDING_TEST_PURPOSE,
  MIDNIGHT_GATE_QUESTION,
  evaluateCaregiverUnderstandingTest,
  isCaregiverEchoFailure,
  improvesUnderstanding,
  improvesOrientation,
  improvesUncertaintyReduction,
  FALSE_REASSURANCE_PATTERNS,
  FALSE_CERTAINTY_PATTERNS,
  PRE_RESPONSE_REASONING_ORDER,
} from "../src/lib/care-reality-intelligence";
import type { ComposedCaregiverResponse } from "../src/lib/caregiver-response-composer";
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
import { resetCareRealityMemoryStore } from "../src/lib/care-reality-intelligence";

console.log("=== 30-Second Caregiver Understanding Test ===\n");
console.log(CAREGIVER_UNDERSTANDING_TEST_PURPOSE);
assert.ok(/midnight|better than before/i.test(MIDNIGHT_GATE_QUESTION));
assert.equal(PRE_RESPONSE_REASONING_ORDER[0], "who");
assert.equal(
  PRE_RESPONSE_REASONING_ORDER[PRE_RESPONSE_REASONING_ORDER.length - 1],
  "one_next_understanding_step",
);

const sot = readFileSync(
  join(process.cwd(), "docs/02-product/solenos-caregiver-understanding-test.md"),
  "utf8",
);
assert.ok(/30-Second Caregiver Understanding Test/i.test(sot));
assert.ok(/Understanding|Orientation|Uncertainty|Priority/i.test(sot));
console.log("✓ SoT + reasoning order");

function baseComposed(
  over: Partial<ComposedCaregiverResponse>,
): ComposedCaregiverResponse {
  return {
    recognition_line: "Held.",
    confirmation: "Beginning of understanding.",
    situation_summary: null,
    what_we_know: [],
    still_unclear: [],
    what_changed: null,
    connection_note: null,
    what_matters_now: null,
    what_can_wait: null,
    what_may_become_serious: null,
    show_clarity: false,
    show_questions: true,
    show_connection: false,
    follow_up_items: [],
    care_story_update: "Beginning of understanding.",
    why_asking: null,
    evidence_line: null,
    is_improvement: false,
    evidence_maturity: 1,
    contract_output: {
      what_is_happening: null,
      what_matters_now: null,
      what_to_ask_next: [],
      risk_level: "Low",
      what_can_wait: null,
      follow_up_items: [],
    },
    ...over,
  };
}

{
  const input = "Mom has been sleeping more and forgetting things.";
  assert.ok(
    isCaregiverEchoFailure({
      latestRawText: input,
      responseBlob: "Mom has been sleeping more and forgetting things.",
    }),
    "echo must fail",
  );

  assert.ok(FALSE_REASSURANCE_PATTERNS.some((p) => p.test("Everything seems fine.")));
  assert.ok(
    FALSE_CERTAINTY_PATTERNS.some((p) =>
      p.test("This is definitely dementia progression."),
    ),
  );

  const echoResult = evaluateCaregiverUnderstandingTest({
    composed: baseComposed({
      situation_summary: "Mom has been sleeping more and forgetting things.",
    }),
    latestRawText: input,
    careRecipient: "Mom",
    isRichCareCapture: true,
    hasRecipientChanges: true,
  });
  assert.equal(echoResult.ok, false);
  assert.ok(echoResult.failures.includes("echo") || echoResult.failures.includes("no_improvement"));

  const goodBlob =
    "Mom's recent confusion appears to be a change from her previous routine, occurring around the same period as her hospital visit. It is unclear whether the medication change contributed. The biggest changes right now are the new safety concern and increased confusion.";
  assert.ok(improvesUnderstanding(goodBlob));
  assert.ok(improvesOrientation(goodBlob) || /around the same/i.test(goodBlob));
  assert.ok(improvesUncertaintyReduction(goodBlob));

  const good = evaluateCaregiverUnderstandingTest({
    composed: baseComposed({
      situation_summary: goodBlob,
      what_changed: "Usual cognitive pattern appears different; safety concern appeared.",
      still_unclear: ["Whether the medication change contributed"],
      what_matters_now: "The biggest changes are safety and increased confusion.",
    }),
    latestRawText:
      "Mom has been confused, tried leaving the house, isn't eating, sleeping more, had a fall scare, and medication changed.",
    careRecipient: "Mom",
    isRichCareCapture: true,
    hasRecipientChanges: true,
  });
  assert.ok(good.ok, `good orientation must pass — ${good.reason}`);
  assert.ok(good.improves_count >= 2);
  assert.ok(good.midnight_pass);
  console.log("✓ echo rejected; understanding orientation passes");
}

{
  resetActiveCareSituationStore();
  resetCareRealityStateStore();
  resetMultiCaregiverContextStore();
  resetFamiliarityBaselineStore();
  resetDecisionMemoryStore();
  resetCareRecipientIdentityStore();
  resetCareRealityMemoryStore();

  const contributorId = "cut_midnight_mom";
  const careKey = resolveCareRealityStoreKey(contributorId);
  setCareRecipientDisplayName({ careKey, displayName: "Mom" });

  const dump =
    "Mom has been confused, tried leaving the house, isn't eating, sleeping more, had a fall scare, and medication changed.";

  const turn = ingestActiveCareObservation({
    caregiverId: contributorId,
    rawText: dump,
    kind: "general",
    nowIso: "2026-07-20T23:30:00.000Z",
  });

  const composed = composeCaregiverResponse({
    turn,
    latestRawText: dump,
    kind: "general",
  });

  const result = evaluateCaregiverUnderstandingTest({
    composed,
    latestRawText: dump,
    careRecipient: "Mom",
    isRichCareCapture: true,
    hasRecipientChanges: true,
  });
  assert.ok(
    result.ok,
    `composed midnight test must pass — ${result.reason} — blob: ${(composed.situation_summary ?? "").slice(0, 200)}`,
  );
  assert.ok(result.improves_count >= 1);
  console.log("✓ live compose passes 30-second midnight test");
}

console.log("\nverify:caregiver-understanding-test OK");
