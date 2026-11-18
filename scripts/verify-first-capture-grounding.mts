import assert from "node:assert/strict";

import {
  assertComposedResponseProfessional,
  composeCaregiverResponse,
} from "../src/lib/caregiver-response-composer";
import {
  ingestActiveCareObservation,
  resetActiveCareSituationStore,
} from "../src/lib/active-care-situation";
import { classifyCareEventKind } from "../src/lib/living-care-record-ux";
import { resetCareContextRootStore } from "../src/lib/situation-entry";
import { resetCareEventStore } from "../src/lib/care-events/store";
import { resetDareStore } from "../src/lib/data-acquisition-resilience";
import { resetNormalizationStore } from "../src/lib/event-normalization/event-normalizer";
import { resetPolicyEngineStore, seedVerifyConsent } from "../src/lib/policy-engine";
import { resetCareRecipientIdentityStore } from "../src/lib/care-recipient-identity";
import { assertResponseAcceptanceGate } from "../src/lib/response-acceptance-gate";

function resetAll(caregiverId: string): void {
  resetActiveCareSituationStore();
  resetCareContextRootStore();
  resetCareEventStore();
  resetDareStore();
  resetNormalizationStore();
  resetPolicyEngineStore();
  resetCareRecipientIdentityStore();
  seedVerifyConsent(caregiverId);
}

const caregiverId = "cg_first_cognition_capture";
resetAll(caregiverId);

const firstReport = "Mum has been forgetting whether she has eaten breakfast.";
const kind = classifyCareEventKind(firstReport);
const turn = ingestActiveCareObservation({
  caregiverId,
  rawText: firstReport,
  kind,
  nowIso: "2026-11-17T19:00:00.000Z",
});
const composed = composeCaregiverResponse({
  turn,
  latestRawText: firstReport,
  kind,
});

assertComposedResponseProfessional(composed);
assert(
  !composed.show_clarity ||
    Boolean(composed.situation_summary?.trim()) ||
    composed.what_we_know.length > 0,
  "A first report must not show Clarity without grounded information about what is happening",
);
assert(
  !/several care concerns/i.test(composed.situation_summary ?? ""),
  "One first report must not be described as several care concerns",
);
assertResponseAcceptanceGate({
  composed,
  careMemoryState: "new_care_reality",
  observationCount: turn.situation.observations.length,
  careWorthyCount: 1,
  latestIsCareWorthy: true,
  latestRawText: firstReport,
  turnClass: "observation",
});

console.log("PASS: first caregiver report remains evidence-safe when a grounded interpretation is not yet available");
