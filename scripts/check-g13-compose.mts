/**
 * Quick G13 compose assert check.
 */
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
import { resetDecisionMemoryStore } from "../src/lib/decision-memory";
import { resetMultiCaregiverContextStore } from "../src/lib/multi-caregiver-context-model";
import { resetCareEpistemicsStores } from "../src/lib/care-epistemics";
import { resetCareRecipientIdentityStore } from "../src/lib/care-recipient-identity";

resetActiveCareSituationStore();
resetCareRealityStateStore();
resetDecisionMemoryStore();
resetMultiCaregiverContextStore();
resetCareEpistemicsStores();
resetCareRecipientIdentityStore();

const careKey = "cg_ui_g13";
const med =
  "The doctor started a blood pressure medication because readings stayed high.";
ingestActiveCareObservation({
  caregiverId: careKey,
  rawText: med,
  kind: classifyCareEventKind(med),
  nowIso: "2026-07-20T10:00:00.000Z",
});
const q = "Why is Mom taking this medication?";
const turn = ingestActiveCareObservation({
  caregiverId: careKey,
  rawText: q,
  kind: classifyCareEventKind(q),
  nowIso: "2026-07-20T11:00:00.000Z",
});
const composed = composeCaregiverResponse({
  turn,
  latestRawText: q,
  kind: classifyCareEventKind(q),
});
console.log("confirmation:", composed.confirmation);
console.log("what_we_know:", composed.what_we_know);
console.log("show_clarity:", composed.show_clarity);
assertComposedResponseProfessional(composed);
console.log("assert OK");
