/**
 * Two-step gather ladder + Jennifer path.
 * Soft-only notes: Held + asks, no Clarity (G1).
 * Orientable care (e.g. refused to eat): light Response Contract orientation + ≤1 ask while gaps remain.
 * Step3: baseline + timing answers deepen orientation.
 */
import {
  composeCaregiverResponse,
  assertComposedResponseProfessional,
} from "../src/lib/caregiver-response-composer";
import {
  ingestActiveCareObservation,
  resetActiveCareSituationStore,
} from "../src/lib/active-care-situation";
import { classifyCareEventKind } from "../src/lib/living-care-record-ux";
import {
  setCareRecipientDisplayName,
  resetCareRecipientIdentityStore,
} from "../src/lib/care-recipient-identity";
import { earlyGatherIncomplete } from "../src/lib/progressive-understanding/questions";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

resetActiveCareSituationStore();
resetCareRecipientIdentityStore();

setCareRecipientDisplayName({ careKey: "cg_jennifer", displayName: "Dad" });
const text = "hi, im jennifer... my dad is sick and herefusedto eat.";
const turn = ingestActiveCareObservation({
  caregiverId: "cg_jennifer",
  rawText: text,
  kind: classifyCareEventKind(text),
  nowIso: "2026-07-18T12:00:00.000Z",
});
assert(earlyGatherIncomplete({ situation: turn.situation }) === false, "orientable care unlocks light orientation");

const composed = composeCaregiverResponse({
  turn,
  latestRawText: text,
  kind: classifyCareEventKind(text),
});
assertComposedResponseProfessional(composed);

console.log("\n=== Step 1: first note ===");
console.log("confirmation:", composed.confirmation);
console.log("what_we_know:", composed.what_we_know);
console.log("asks:", composed.still_unclear);
console.log("show_clarity:", composed.show_clarity);
console.log("what_matters_now:", composed.what_matters_now);

assert(/preserved|held|Living Care Record|carry|Beginning/i.test(composed.confirmation), "held");
assert(composed.what_we_know.length >= 1, "facts held on step 1");
assert(composed.show_clarity === true, "orientable care → light Clarity (Response Contract relief)");
assert(composed.what_matters_now != null, "what matters now for orientation");
assert(composed.what_can_wait != null, "what can wait for orientation");
assert(composed.still_unclear.length === 1, "Step1: exactly one high-value ask while gaps remain");
assert(
  /noticed|alongside|going on|else|usual|start|when/i.test(composed.still_unclear[0] ?? ""),
  "Step1 ask is context/gap invite",
);
assert(
  !composed.still_unclear.some((q) => /head|fluid|walking normally|usually eat/i.test(q)),
  "no keyword quiz",
);

// Step 2 — more context (gaps may still remain until baseline/timing answered)
const t2 = ingestActiveCareObservation({
  caregiverId: "cg_jennifer",
  rawText: "He also seemed quieter after lunch and pushed the plate away.",
  kind: classifyCareEventKind(
    "He also seemed quieter after lunch and pushed the plate away.",
  ),
  nowIso: "2026-07-18T12:10:00.000Z",
});
const c2 = composeCaregiverResponse({
  turn: t2,
  latestRawText: "He also seemed quieter after lunch and pushed the plate away.",
  kind: classifyCareEventKind(
    "He also seemed quieter after lunch and pushed the plate away.",
  ),
});
assertComposedResponseProfessional(c2);
console.log("\n=== Step 2: more context ===");
console.log("gatherIncomplete:", earlyGatherIncomplete({ situation: t2.situation }));
console.log("asks:", c2.still_unclear);
console.log("show_clarity:", c2.show_clarity);

assert(c2.show_clarity === true, "Step2: Clarity remains for orientable care");
assert(
  earlyGatherIncomplete({ situation: t2.situation }) === false,
  "Step2: orientable care stays orientation-sufficient",
);
assert(c2.still_unclear.length <= 3, "Step2: at most 1–3 asks when gaps remain");
assert(
  !c2.still_unclear.some((q) => /head|fluid|walking normally/i.test(q)),
  "Step2: no keyword quiz",
);

// Step 3 — answer baseline + timing → Clarity
const t3 = ingestActiveCareObservation({
  caregiverId: "cg_jennifer",
  rawText: "This is new for him — started yesterday after lunch.",
  kind: classifyCareEventKind("This is new for him — started yesterday after lunch."),
  nowIso: "2026-07-18T12:20:00.000Z",
});
const c3 = composeCaregiverResponse({
  turn: t3,
  latestRawText: "This is new for him — started yesterday after lunch.",
  kind: classifyCareEventKind("This is new for him — started yesterday after lunch."),
});
assertComposedResponseProfessional(c3);
console.log("\n=== Step 3: gaps answered ===");
console.log("gatherIncomplete:", earlyGatherIncomplete({ situation: t3.situation }));
console.log("show_clarity:", c3.show_clarity);
console.log("what_matters_now:", c3.what_matters_now);

assert(!earlyGatherIncomplete({ situation: t3.situation }), "gather complete");
assert(c3.show_clarity === true, "Clarity after understanding");
assert(c3.what_matters_now != null, "matters after understanding");
assert(
  !/stay with that|doing well right now|Track food and fluid|% confidence/i.test(
    c3.what_matters_now ?? "",
  ),
  "no invented theater / keyword Clarity",
);

console.log("✓ Jennifer ladder — Step1 invite → Step2 asks → Step3 Clarity\n");
