/**
 * verify-care-context-durability.mts
 * CareContext + ACS survive process bounce (Map cleared; durable `.data/` reloads).
 */

import {
  clearActiveCareSituationMemoryCache,
  getActiveCareSituation,
  resetActiveCareSituationStore,
} from "../src/lib/active-care-situation";
import { resetCareEventStore } from "../src/lib/care-events/store";
import { resetDareStore } from "../src/lib/data-acquisition-resilience";
import { resetNormalizationStore } from "../src/lib/event-normalization/event-normalizer";
import { LIVING_CARE_RECORD_UX } from "../src/lib/solenos-layers/architecture-map";
import { resetPolicyEngineStore, seedVerifyConsent } from "../src/lib/policy-engine";
import { resetResolutionStoreForTests } from "../src/lib/resolution-engine/persistence";
import {
  clearCareContextMemoryCache,
  getCareContextRoot,
  processSituationInput,
  resetCareContextRootStore,
} from "../src/lib/situation-entry";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== SolenOS CareContext / ACS durability ===\n");

assert(
  LIVING_CARE_RECORD_UX.careContextDurability.includes(".data/care-context"),
  "arch map documents CareContext durability",
);
assert(
  LIVING_CARE_RECORD_UX.activeCareSituationPersistence.includes(".data/active-care-situation"),
  "arch map documents ACS durability",
);

resetCareContextRootStore();
resetActiveCareSituationStore();
resetCareEventStore();
resetDareStore();
resetNormalizationStore();
resetPolicyEngineStore();
resetResolutionStoreForTests();
seedVerifyConsent("cg_durable");

const first = await processSituationInput({
  raw_input: "She's frustrated today.",
  caregiver_id: "cg_durable",
  timestamp: "2026-07-16T14:00:00.000Z",
});

const second = await processSituationInput({
  raw_input: "She's sad.",
  caregiver_id: "cg_durable",
  timestamp: "2026-07-16T14:05:00.000Z",
});

assert(first.context.events.length >= 1, "first write created CareEvents");
assert(second.context.events.length >= 2, "second write appended CareEvents");
assert(second.active_care_situation != null, "ACS present before bounce");
assert(
  (second.active_care_situation?.observations.length ?? 0) >= 2,
  "ACS has related observations before bounce",
);

const eventIdsBefore = second.context.events.map((e) => e.id);
const situationIdBefore = second.active_care_situation!.id;
const observationCountBefore = second.active_care_situation!.observations.length;
const situationIdOnEvents = second.events_created[0]?.situation_id;

console.log("✓ wrote CareContext + ACS to durable store");

// Simulate process bounce — memory cache gone; durable files remain.
clearCareContextMemoryCache();
clearActiveCareSituationMemoryCache();
resetResolutionStoreForTests();

const reloaded = getCareContextRoot("cg_durable");
assert(reloaded != null, "CareContext reloads from durable store after bounce");
assert(reloaded!.events.length === eventIdsBefore.length, "event count survives bounce");
assert(
  reloaded!.events.every((e, i) => e.id === eventIdsBefore[i]),
  "event ids survive bounce",
);
assert(
  reloaded!.events.every((e) => e.raw_input.length > 0),
  "raw caregiver words preserved on durable spine",
);

const acsReloaded = getActiveCareSituation("cg_durable");
assert(acsReloaded != null, "ACS reloads from durable store after bounce");
assert(acsReloaded!.id === situationIdBefore, "ACS id survives bounce");
assert(
  acsReloaded!.observations.length === observationCountBefore,
  "ACS observations survive bounce",
);
assert(
  reloaded!.events.some((e) => e.situation_id === situationIdOnEvents),
  "situation_id stamps survive bounce on CareContext",
);

console.log("✓ CareContext + ACS survive Map-clear bounce via `.data/`");

// Third write after bounce continues the same durable situation.
const third = await processSituationInput({
  raw_input: "She keeps saying she wants to go home.",
  caregiver_id: "cg_durable",
  timestamp: "2026-07-16T14:10:00.000Z",
});
assert(third.context.events.length >= 3, "post-bounce write appends to durable CareContext");
assert(
  third.active_care_situation?.id === situationIdBefore,
  "soft update after bounce continues same ACS",
);
console.log("✓ continuity continues on durable spine after bounce");

resetCareContextRootStore();
resetActiveCareSituationStore();
assert(getCareContextRoot("cg_durable") == null, "full reset clears durable CareContext");
assert(getActiveCareSituation("cg_durable") == null, "full reset clears durable ACS");
console.log("✓ reset clears durable SoT for verify isolation");

console.log("\n=== CareContext durability: all checks passed ===\n");
