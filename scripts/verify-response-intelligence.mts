/**
 * Response Intelligence — golden soft inputs + no AI product language + no phrase templates.
 */
import assert from "node:assert/strict";
import {
  RESPONSE_GOLDEN_SOFT_INPUTS,
  RESPONSE_INTELLIGENCE_PURPOSE,
  evaluateGoldenSoftOrientation,
  assertNoAiProductLanguage,
  buildResponseIntelligenceOutput,
  containsAiProductLanguage,
} from "../src/lib/response-intelligence";
import {
  ingestActiveCareObservation,
  resetActiveCareSituationStore,
} from "../src/lib/active-care-situation";
import { resetCareRealityStateStore } from "../src/lib/care-reality-state";
import { classifyCareEventKind } from "../src/lib/living-care-record-ux";
import {
  composeCaregiverResponse,
  assertComposedResponseProfessional,
} from "../src/lib/caregiver-response-composer";
import { classifyCaregiverTurn } from "../src/lib/response-behavior";
import { resetDecisionMemoryStore } from "../src/lib/decision-memory";
import { resetMultiCaregiverContextStore } from "../src/lib/multi-caregiver-context-model";
import { resetCareEpistemicsStores } from "../src/lib/care-epistemics";
import { resetCareRecipientIdentityStore } from "../src/lib/care-recipient-identity";

function resetAll(): void {
  resetActiveCareSituationStore();
  resetCareRealityStateStore();
  resetDecisionMemoryStore();
  resetMultiCaregiverContextStore();
  resetCareEpistemicsStores();
  resetCareRecipientIdentityStore();
}

console.log("=== Response Intelligence ===\n");
console.log(RESPONSE_INTELLIGENCE_PURPOSE);

assert.equal(RESPONSE_GOLDEN_SOFT_INPUTS.length, 5);
assert(containsAiProductLanguage("I extracted 8 medications."));
assert(!containsAiProductLanguage("Held in the Living Care Record."));

{
  const out = buildResponseIntelligenceOutput({
    what_is_happening: "Sleep pattern changed after the hospital visit; reason unclear.",
    what_matters_now: "Whether this sleep change continues and how it relates to the recent medication change.",
    what_to_ask_next: ["Do you know why the medication was changed?"],
    what_can_wait: "Older paperwork until the recent change is clearer.",
    follow_up_items: ["Notice whether the sleep pattern holds"],
    has_meaningful_change: true,
    has_open_unknowns: true,
  });
  assert.equal(out.risk_level, "medium");
  assertNoAiProductLanguage(Object.values(out).flatMap((v) => (Array.isArray(v) ? v : [v])));
  console.log("✓ structured output from understanding (not a blank form)");
}

let i = 0;
for (const input of RESPONSE_GOLDEN_SOFT_INPUTS) {
  resetAll();
  i += 1;
  const careKey = `cg_ri_golden_${i}`;
  const kind = classifyCareEventKind(input);
  const turn = ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: input,
    kind,
    nowIso: `2026-07-19T1${i}:00:00.000Z`,
  });
  const turnClass = classifyCaregiverTurn({
    latestRawText: input,
    kind,
    turn,
  });
  const composed = composeCaregiverResponse({
    turn,
    latestRawText: input,
    kind,
    hasDocuments: /discharge paper/i.test(input),
  });
  assertComposedResponseProfessional(composed);
  const check = evaluateGoldenSoftOrientation({
    input,
    confirmation: composed.confirmation,
    what_we_know: composed.what_we_know,
    what_changed: composed.what_changed,
    situation_summary: composed.situation_summary,
    what_matters_now: composed.what_matters_now,
    still_unclear: composed.still_unclear,
    show_clarity: composed.show_clarity,
  });
  assert(
    check.ok,
    `Golden soft ${i} failed (${input}): ${check.failures.join(", ")} [class=${turnClass}] conf=${composed.confirmation}`,
  );
  console.log(`✓ golden soft ${i}: ${input.slice(0, 42)}…`);
}

console.log("\n=== Response Intelligence: all checks passed ===\n");
