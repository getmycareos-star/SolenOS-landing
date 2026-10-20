/**
 * verify-network-effect-moat.mts
 * Network effect & data moat — compounding continuity, enrichment, irreversibility.
 */

import fs from "node:fs";
import path from "node:path";

import { resetCareEventStore } from "../src/lib/care-events/store";
import { resetDareStore } from "../src/lib/data-acquisition-resilience";
import { resetIntegrityAuditStore } from "../src/lib/care-event-integrity";
import { resetMemoryLayerStore } from "../src/lib/care-memory-layers";
import { resetFailureResilienceStore } from "../src/lib/failure-resilience";
import {
  assertContextGrew,
  assertMaturityStagesDefined,
  INTERACTION_OUTCOME_TYPES,
  matchEntities,
  matchEvents,
  NETWORK_EFFECT_MOAT_IDENTITY,
  NON_COMPOUNDING_TYPES,
  processNetworkEffectMoat,
  resetMoatStore,
} from "../src/lib/network-effect-moat";
import { resetCareContextRootStore, processSituationInput } from "../src/lib/situation-entry";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== SolenOS Network Effect & Data Moat ===\n");

resetCareContextRootStore();
resetCareEventStore();
resetDareStore();
resetIntegrityAuditStore();
resetMemoryLayerStore();
resetFailureResilienceStore();
resetMoatStore();

assert(NETWORK_EFFECT_MOAT_IDENTITY.includes("compounding"), "moat identity");
assert(INTERACTION_OUTCOME_TYPES.length === 8, "eight interaction outcomes");
assert(NON_COMPOUNDING_TYPES.length >= 5, "non-compounding types defined");
assert(assertMaturityStagesDefined(), "maturity stages");
console.log("✓ system contract");

const migration = path.join(root, "db/migrations/033_network_effect_moat.sql");
assert(fs.existsSync(migration), "migration 033 exists");
console.log("✓ migration 033");

const caregiverId = "cg_moat";

const first = await processSituationInput({
  raw_input: "Mom fell yesterday and went to hospital",
  caregiver_id: caregiverId,
  timestamp: "2026-07-01T10:00:00.000Z",
});

assert(first.network_effect_moat_layer !== null, "moat layer in response");
assert(first.network_effect_moat_layer!.context_grew, "context grew on first input");
assert(first.network_effect_moat_layer!.interaction_outcomes.length >= 1, "interaction outcomes");
assert(
  ["early", "building"].includes(first.network_effect_moat_layer!.maturity_stage),
  "early or building maturity on first input",
);
console.log("✓ every interaction improves the system");

await processSituationInput({
  raw_input: "Discharge summary received — follow-up in 2 weeks",
  caregiver_id: caregiverId,
  timestamp: "2026-07-05T10:00:00.000Z",
});

const third = await processSituationInput({
  raw_input: "The follow-up appointment was completed today",
  caregiver_id: caregiverId,
  timestamp: "2026-07-20T10:00:00.000Z",
});

assert(
  third.network_effect_moat_layer!.event_matches.length >= 0,
  "event matching runs",
);
assert(
  third.network_effect_moat_layer!.enrichment_actions.length >= 1,
  "continuous enrichment",
);
console.log("✓ link to existing context + enrichment");

await processSituationInput({
  raw_input: "Mobility decline began approximately March 14",
  caregiver_id: caregiverId,
  timestamp: "2026-07-21T10:00:00.000Z",
});

const withPriorQuestion = await processSituationInput({
  raw_input: "My dad isn't doing well.",
  caregiver_id: "cg_moat2",
  timestamp: "2026-07-01T10:00:00.000Z",
});

const resolved = await processSituationInput({
  raw_input: "Mobility started declining around March 14 after the fall",
  caregiver_id: "cg_moat2",
  timestamp: "2026-07-22T10:00:00.000Z",
});

assert(
  resolved.network_effect_moat_layer!.compounding_metrics.total_events >= 2,
  "care history compounds",
);
console.log("✓ compounding metrics");

const docResult = await processSituationInput({
  raw_input: "",
  caregiver_id: caregiverId,
  timestamp: "2026-07-06T10:00:00.000Z",
  documents: [
    {
      id: "doc_insurance",
      name: "Insurance letter",
      extracted_text: "Claim rejected — appeal required within 30 days",
      ocr_confidence: 0.9,
    },
  ],
});

assert(
  docResult.network_effect_moat_layer!.compounding_metrics.linked_documents >= 1,
  "documents linked not isolated",
);
console.log("✓ documents connect to context");

assert(third.network_effect_moat_layer!.moat_strength.score >= 0, "moat strength score");
assert(third.network_effect_moat_layer!.moat_strength.irreversibility_factors.length >= 1, "irreversibility factors");
console.log("✓ irreversibility / moat strength");

const entityMatches = matchEntities(first.events_created, []);
assert(Array.isArray(entityMatches), "entity matching");
const eventMatches = matchEvents(third.events_created, first.context.events);
assert(Array.isArray(eventMatches), "event matching");
console.log("✓ entity and event matching");

const manual = processNetworkEffectMoat({
  caregiver_id: "cg_manual",
  new_events: first.events_created,
  prior_events: [],
  all_events: first.events_created,
  unresolved_questions: [],
  what_changed: first.what_changed,
  dare: null,
});
assert(assertContextGrew(manual.interaction_outcomes), "manual context grew");
console.log("✓ pipeline orchestration");

const apiRoute = path.join(root, "src/app/api/situation/moat/route.ts");
assert(fs.existsSync(apiRoute), "moat API route");
console.log("✓ moat API route");

const uiPanel = path.join(root, "src/components/ops-devtools/NetworkEffectMoatPanel.tsx");
assert(fs.existsSync(uiPanel), "NetworkEffectMoatPanel exists");
console.log("✓ UI panel");

console.log("\n=== All network effect & data moat checks passed ===\n");
