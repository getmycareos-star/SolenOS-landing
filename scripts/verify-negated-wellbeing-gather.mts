/**
 * Negated wellbeing must never be improvement; incomplete care note → gap asks, not Clarity.
 * Illustration only — not a phrase product rule.
 */
import assert from "node:assert/strict";
import {
  detectObservationSignals,
  looksLikeImprovementNote,
} from "../src/lib/progressive-understanding/detect-signals";
import {
  composeCaregiverResponse,
  assertComposedResponseProfessional,
} from "../src/lib/caregiver-response-composer";
import {
  ingestActiveCareObservation,
  resetActiveCareSituationStore,
} from "../src/lib/active-care-situation";
import { refineHumanFact } from "../src/lib/active-care-situation/classify";
import { classifyCareEventKind } from "../src/lib/living-care-record-ux";
import { resetCareRecipientIdentityStore } from "../src/lib/care-recipient-identity";

resetActiveCareSituationStore();
resetCareRecipientIdentityStore();

const text = "dad hasnt been feeling well lately and refuses fod";

assert.equal(looksLikeImprovementNote(text), false, "negated wellbeing ≠ improvement");
assert.equal(
  looksLikeImprovementNote("shes feeling well now and happy."),
  true,
  "true improvement still detected",
);
assert.equal(
  looksLikeImprovementNote("shes not feeling well and im confused"),
  false,
  "not feeling well ≠ improvement",
);

const fact = refineHumanFact(text, "Dad", { isFirst: true });
assert.ok(!/feeling better|doing well right now/i.test(fact), `fact must not invent improvement: ${fact}`);

const signals = detectObservationSignals(text, classifyCareEventKind(text));
assert.ok(!signals.includes("improvement"), "no improvement signal");

const careKey = `cg_negated_well_${Date.now()}`;
const turn = ingestActiveCareObservation({
  caregiverId: careKey,
  rawText: text,
  kind: classifyCareEventKind(text),
  nowIso: "2026-07-18T13:00:00.000Z",
});
const composed = composeCaregiverResponse({
  turn,
  latestRawText: text,
  kind: classifyCareEventKind(text),
});
assertComposedResponseProfessional(composed);

console.log("\n=== Negated wellbeing / gather-first ===");
console.log("human_fact:", turn.situation.observations[0]?.human_fact);
console.log("what_needs_context:", turn.what_needs_context);
console.log("confirmation:", composed.confirmation);
console.log("what_we_know:", composed.what_we_know);
console.log("asks:", composed.still_unclear);
console.log("show_clarity:", composed.show_clarity);
console.log("what_matters_now:", composed.what_matters_now);

assert.equal(composed.is_improvement, false, "not improvement turn");
assert.equal(composed.show_clarity, true, "orientable care → light Clarity (not improvement theater)");
assert.ok(composed.what_matters_now, "what matters now for orientation");
assert.ok(
  composed.still_unclear.length <= 1,
  "at most one high-value ask while gaps remain",
);
assert.ok(
  !/doing well right now|feeling better now|They are feeling better/i.test(
    [composed.confirmation, ...composed.what_we_know, composed.what_matters_now ?? ""].join(" "),
  ),
  "must not invent improvement",
);
assert.ok(
  !composed.still_unclear.some((q) => /head|fluid|walking normally/i.test(q)),
  "no keyword quiz",
);

console.log("✓ Negated wellbeing → orientation without fake improvement\n");
