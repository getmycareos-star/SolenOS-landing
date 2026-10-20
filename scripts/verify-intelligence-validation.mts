/**
 * Hard Rejection & Intelligence Validation Layer.
 * SoT: docs/02-product/solenos-intelligence-validation.md
 *
 * Illustration fixtures only — never product if-branches.
 */
import "./_verify-env.mts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  INTELLIGENCE_VALIDATION_PURPOSE,
  INTELLIGENCE_GATE_QUESTION,
  validateIntelligenceResponse,
  isSentenceSummaryFailure,
  isTaskGeneratorFailure,
  isGenericSafetyFailure,
  isFamilyDistractionFailure,
  isExcessiveQuestioningFailure,
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

console.log("=== Intelligence Validation (Hard Rejection) ===\n");
console.log(INTELLIGENCE_VALIDATION_PURPOSE);
assert.ok(/changing care reality/i.test(INTELLIGENCE_GATE_QUESTION));

const sot = readFileSync(
  join(process.cwd(), "docs/02-product/solenos-intelligence-validation.md"),
  "utf8",
);
assert.ok(/Hard Rejection|rejection test/i.test(sot));
assert.ok(/Sentence Summary|Task Generator|Generic Safety/i.test(sot));
console.log("✓ SoT present");

const hardInput =
  "Mom has been confused, tried leaving the house, isn't eating, sleeping more, had a fall scare, and medication changed.";

function emptyComposed(over: Partial<ComposedCaregiverResponse>): ComposedCaregiverResponse {
  return {
    recognition_line: "Held.",
    confirmation:
      "Beginning of Mom's Living Care Record — held so you do not have to reconstruct it later.",
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
  // Failure 1 — sentence summary
  assert.ok(
    isSentenceSummaryFailure({
      latestRawText: hardInput,
      responseBlob:
        "Your mom has been confused, tried leaving the house, has reduced eating, increased sleeping, experienced a fall scare, and had a medication change.",
    }),
    "sentence summary must fail",
  );

  // Failure 2 — tasks
  assert.ok(
    isTaskGeneratorFailure(
      "Things to do: ☐ Monitor symptoms ☐ Call doctor ☐ Check medication ☐ Watch eating ☐ Track sleep",
    ),
  );

  // Failure 3 — generic safety
  assert.ok(
    isGenericSafetyFailure({
      latestRawText: hardInput,
      responseBlob:
        "Confusion and falls can be serious. Please contact a healthcare provider.",
    }),
  );

  // Failure 4 — family distraction
  assert.ok(
    isFamilyDistractionFailure({
      responseBlob: "Your brother may need to understand your concerns better.",
      careRecipient: "Mom",
      hasRecipientChanges: true,
    }),
  );

  // Failure 5 — excessive questions
  assert.ok(
    isExcessiveQuestioningFailure({
      stillUnclear: [
        "When did this start?",
        "How old is your mother?",
        "What medication?",
        "What dosage?",
        "How often does this happen?",
      ],
      responseBlob: "When? How old? What medication? What dosage? How often?",
    }),
  );

  const failSummary = validateIntelligenceResponse({
    composed: emptyComposed({
      situation_summary:
        "Your mom has been confused, tried leaving the house, has reduced eating, increased sleeping, experienced a fall scare, and had a medication change.",
    }),
    latestRawText: hardInput,
    careRecipient: "Mom",
    isRichCareCapture: true,
    isInitialAssessment: true,
    hasRecipientChanges: true,
  });
  assert.equal(failSummary.ok, false);
  assert.ok(failSummary.failures.includes("sentence_summary"));
  console.log("✓ hard failure modes rejected");
}

{
  resetActiveCareSituationStore();
  resetCareRealityStateStore();
  resetMultiCaregiverContextStore();
  resetFamiliarityBaselineStore();
  resetDecisionMemoryStore();
  resetCareRecipientIdentityStore();
  resetCareRealityMemoryStore();

  const contributorId = "iv_hard_mom";
  const careKey = resolveCareRealityStoreKey(contributorId);
  setCareRecipientDisplayName({ careKey, displayName: "Mom" });

  const turn = ingestActiveCareObservation({
    caregiverId: contributorId,
    rawText: hardInput,
    kind: "general",
    nowIso: "2026-07-20T23:00:00.000Z",
  });

  const composed = composeCaregiverResponse({
    turn,
    latestRawText: hardInput,
    kind: "general",
  });

  const blob = [
    composed.situation_summary ?? "",
    composed.what_changed ?? "",
    composed.connection_note ?? "",
    ...(composed.what_we_know ?? []),
    ...(composed.still_unclear ?? []),
  ].join(" ");

  assert.ok(
    !isSentenceSummaryFailure({ latestRawText: hardInput, responseBlob: blob }),
    `must not be sentence echo — got: ${blob.slice(0, 400)}`,
  );
  assert.ok(!isTaskGeneratorFailure(blob));
  assert.ok(
    !isGenericSafetyFailure({ latestRawText: hardInput, responseBlob: blob }),
  );
  assert.ok(
    /chang|usual|unclear|related|connect|concern|sleep|leav|medication|understanding/i.test(
      blob,
    ),
    `must orient to care reality — got: ${blob.slice(0, 400)}`,
  );
  assert.ok(
    (composed.still_unclear?.length ?? 0) <= 3,
    "at most three asks",
  );

  const gate = validateIntelligenceResponse({
    composed,
    latestRawText: hardInput,
    careRecipient: "Mom",
    isRichCareCapture: true,
    isInitialAssessment: true,
    hasRecipientChanges: true,
  });
  assert.ok(gate.ok, `composed must pass intelligence gate — ${gate.reason}`);
  console.log("✓ hard scenario compose passes understanding gate");
}

console.log("\nverify:intelligence-validation OK");
