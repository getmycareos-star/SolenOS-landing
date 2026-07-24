/**
 * verify-living-care-record-regression.mts
 *
 * Happy-path ACS/LCR verifies are not enough. This suite must catch:
 * 1) refresh persistence (CareContext + ACS survive Map-clear bounce)
 * 2) CareContext ↔ ACS situation_id / root_event_id linking
 * 3) continuity_home + caregiver DTO sanitizer bans
 * 4) crisis false-positive suite (ordinary continuity stays calm)
 */

import fs from "node:fs";
import path from "node:path";

import {
  clearActiveCareSituationMemoryCache,
  getActiveCareSituation,
  resetActiveCareSituationStore,
} from "../src/lib/active-care-situation";
import { resetCareEventStore } from "../src/lib/care-events/store";
import { resetDareStore } from "../src/lib/data-acquisition-resilience";
import { resetNormalizationStore } from "../src/lib/event-normalization/event-normalizer";
import {
  assertCaregiverDtoSanitized,
  assertContinuityHomeSanitized,
  buildLivingCareRecordResponse,
  CRISIS_FALSE_POSITIVE_FIXTURES,
} from "../src/lib/living-care-record-ux";
import {
  assertCaregiverDtoExcludesInternalCompile,
  toCaregiverSituationResponse,
} from "../src/lib/situation-entry/caregiver-response-dto";
import { resetMvpSurfaceStore } from "../src/lib/mvp-surface-area";
import { resetPolicyEngineStore, seedVerifyConsent } from "../src/lib/policy-engine";
import { resetResolutionStoreForTests } from "../src/lib/resolution-engine/persistence";
import { LIVING_CARE_RECORD_UX } from "../src/lib/solenos-layers/architecture-map";
import {
  clearCareContextMemoryCache,
  getCareContextRoot,
  processSituationInput,
  resetCareContextRootStore,
} from "../src/lib/situation-entry";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function resetAll(caregiverId: string) {
  resetCareContextRootStore();
  resetActiveCareSituationStore();
  resetCareEventStore();
  resetDareStore();
  resetNormalizationStore();
  resetPolicyEngineStore();
  resetResolutionStoreForTests();
  resetMvpSurfaceStore();
  seedVerifyConsent(caregiverId);
}

console.log("=== SolenOS Living Care Record regression (persistence · relation · DTO · crisis FP) ===\n");

assert(
  fs.existsSync(path.join(root, "scripts/verify-living-care-record-regression.mts")),
  "regression verify present",
);
assert(
  LIVING_CARE_RECORD_UX.regressionCoverage?.includes("persistence") ||
    LIVING_CARE_RECORD_UX.careContextDurability.includes(".data/care-context"),
  "arch map documents regression durability",
);

// ─── 1) Refresh persistence ─────────────────────────────────────────────────
resetAll("cg_lcr_persist");

const p1 = await processSituationInput({
  raw_input: "She's frustrated today.",
  caregiver_id: "cg_lcr_persist",
  timestamp: "2026-07-16T14:00:00.000Z",
});
const p2 = await processSituationInput({
  raw_input: "She's sad.",
  caregiver_id: "cg_lcr_persist",
  timestamp: "2026-07-16T14:05:00.000Z",
});

assert(p2.active_care_situation != null, "ACS before bounce");
assert((p2.active_care_situation?.observations.length ?? 0) >= 2, "ACS observations before bounce");
assert(p2.context.events.length >= 2, "CareContext events before bounce");

const acsIdBefore = p2.active_care_situation!.id;
const eventCountBefore = p2.context.events.length;

clearCareContextMemoryCache();
clearActiveCareSituationMemoryCache();
resetResolutionStoreForTests();

const ctxAfter = getCareContextRoot("cg_lcr_persist");
const acsAfter = getActiveCareSituation("cg_lcr_persist");
assert(ctxAfter != null, "CareContext reloads after refresh/bounce");
assert(acsAfter != null, "ACS reloads after refresh/bounce");
assert(ctxAfter!.events.length === eventCountBefore, "event count survives refresh");
assert(acsAfter!.id === acsIdBefore, "ACS id survives refresh");
assert(acsAfter!.observations.length >= 2, "ACS observations survive refresh");

const p3 = await processSituationInput({
  raw_input: "She keeps saying she wants to go home.",
  caregiver_id: "cg_lcr_persist",
  timestamp: "2026-07-16T14:10:00.000Z",
});
assert(p3.active_care_situation?.id === acsIdBefore, "soft note after refresh continues same ACS");
assert(p3.context.events.length > eventCountBefore, "CareContext appends after refresh");
console.log("✓ refresh persistence: CareContext + ACS survive bounce and continue");

// ─── 2) CareContext ↔ ACS relation ──────────────────────────────────────────
resetAll("cg_lcr_link");

const soft1 = await processSituationInput({
  raw_input: "She's frustrated.",
  caregiver_id: "cg_lcr_link",
  timestamp: "2026-07-16T10:00:00.000Z",
});
const soft2 = await processSituationInput({
  raw_input: "She's quieter this afternoon.",
  caregiver_id: "cg_lcr_link",
  timestamp: "2026-07-16T22:00:00.000Z", // same day, outside 12h window
});

assert(soft1.active_care_situation != null, "soft1 ACS");
assert(soft2.active_care_situation?.id === soft1.active_care_situation?.id, "soft same-day shares ACS");
assert(
  soft1.events_created.every((e) => e.situation_id === soft1.active_care_situation?.id),
  "CareEvents.situation_id matches ACS id (opens_new)",
);
assert(
  soft2.events_created.every((e) => e.situation_id === soft1.active_care_situation?.id),
  "CareEvents.situation_id matches ACS id (soft update)",
);
assert(
  soft2.events_created.every((e) => e.root_event_id === soft1.events_created[0]?.id),
  "soft update shares root_event_id with CareContext spine",
);
assert(
  soft2.context.events.filter((e) => e.situation_id === soft1.active_care_situation?.id).length >= 2,
  "CareContext group linked to ACS via situation_id",
);
assert(
  soft2.care_situation_groups?.some(
    (g) => g.situation_id === soft1.active_care_situation?.id && g.event_ids.length >= 2,
  ),
  "care_situation_groups mirrors CareContext↔ACS link",
);

const hard = await processSituationInput({
  raw_input: "Mom fell yesterday. We went to urgent care.",
  caregiver_id: "cg_lcr_link",
  timestamp: "2026-07-16T22:30:00.000Z",
});
assert(
  hard.active_care_situation?.id !== soft1.active_care_situation?.id,
  "hard incident opens new ACS",
);
assert(
  hard.events_created[0]?.situation_id === hard.active_care_situation?.id,
  "hard CareEvent situation_id matches new ACS",
);
assert(
  hard.events_created[0]?.situation_id !== soft1.active_care_situation?.id,
  "hard CareEvent not stamped onto soft ACS",
);
assert((hard.care_situation_groups?.length ?? 0) >= 2, "groups separate soft ACS from hard");

// Link must survive bounce
clearCareContextMemoryCache();
clearActiveCareSituationMemoryCache();
const linkedCtx = getCareContextRoot("cg_lcr_link");
const linkedAcs = getActiveCareSituation("cg_lcr_link");
assert(linkedAcs?.id === hard.active_care_situation?.id, "ACS after bounce is hard situation");
assert(
  linkedCtx?.events.some((e) => e.situation_id === soft1.active_care_situation?.id),
  "soft situation_id stamps survive on CareContext after bounce",
);
assert(
  linkedCtx?.events.some((e) => e.situation_id === hard.active_care_situation?.id),
  "hard situation_id stamps survive on CareContext after bounce",
);
console.log("✓ CareContext ↔ ACS relation: situation_id / root_event_id / groups");

// ─── 3) continuity_home + caregiver DTO sanitizer ────────────────────────────
resetAll("cg_lcr_dto");

const firstDto = await processSituationInput({
  raw_input: "Dad has been refusing to eat.",
  caregiver_id: "cg_lcr_dto",
  timestamp: "2026-07-01T10:00:00.000Z",
});
const secondDto = await processSituationInput({
  raw_input: "He also missed his morning medication today.",
  caregiver_id: "cg_lcr_dto",
  timestamp: "2026-07-02T10:00:00.000Z",
});

assert(secondDto.mvp_surface_area_layer.continuity_home != null, "continuity_home present");
assertContinuityHomeSanitized(secondDto.mvp_surface_area_layer.continuity_home, "continuity_home");
assertCaregiverDtoSanitized(
  {
    what_is_uncertain: secondDto.what_is_uncertain,
    what_needs_clarification: secondDto.what_needs_clarification,
    what_i_understood: secondDto.what_i_understood,
    open_uncertainties: secondDto.context.open_uncertainties,
  },
  "situation response caregiver fields",
);
assertCaregiverDtoSanitized(secondDto.mvp_surface_area_layer.post_entry, "post_entry");
assertCaregiverDtoSanitized(secondDto.mvp_surface_area_layer.aha_moment, "aha_moment");

const lcrView = buildLivingCareRecordResponse({
  response: secondDto,
  rawInput: "He also missed his morning medication today.",
});
assertCaregiverDtoSanitized(lcrView, "LivingCareRecordResponseView");
assert(!/%/.test(lcrView.confidence_label), "LCR confidence_label has no percent");
assertCaregiverDtoSanitized(firstDto.mvp_surface_area_layer.aha_moment, "first aha_moment");

const caregiverProjection = toCaregiverSituationResponse(secondDto);
assertCaregiverDtoExcludesInternalCompile(
  caregiverProjection as Record<string, unknown>,
  "toCaregiverSituationResponse(secondDto)",
);
assert(!("final_output" in caregiverProjection), "caregiver DTO must not include final_output");
console.log("✓ continuity_home + caregiver DTO sanitizer bans + no final_output leak");

// ─── 4) Crisis false-positive suite ─────────────────────────────────────────
resetAll("cg_lcr_crisis_fp");

for (let i = 0; i < CRISIS_FALSE_POSITIVE_FIXTURES.length; i++) {
  const fixture = CRISIS_FALSE_POSITIVE_FIXTURES[i]!;
  const hour = String(10 + i).padStart(2, "0");
  const response = await processSituationInput({
    raw_input: fixture.raw_input,
    caregiver_id: "cg_lcr_crisis_fp",
    timestamp: `2026-07-16T${hour}:00:00.000Z`,
  });
  assert(response.events_created.length >= 1 || response.context.events.length >= 1, `${fixture.id}: still captured`);
  assert(
    response.crisis_mode_interaction_layer?.crisis_mode !== true,
    `FP ${fixture.id}: crisis_mode must be false (${fixture.note})`,
  );
  assert(
    response.crisis_mode_interaction_layer?.active !== true,
    `FP ${fixture.id}: crisis layer must be inactive (${fixture.note})`,
  );
  assertCaregiverDtoSanitized(
    {
      what_is_uncertain: response.what_is_uncertain,
      what_needs_clarification: response.what_needs_clarification,
    },
    `FP ${fixture.id} caregiver fields`,
  );
  const view = buildLivingCareRecordResponse({
    response,
    rawInput: fixture.raw_input,
  });
  assertCaregiverDtoSanitized(view, `FP ${fixture.id} LCR view`);
  console.log(`✓ crisis FP: ${fixture.id}`);
}

console.log("\n=== Living Care Record regression: all checks passed ===\n");
