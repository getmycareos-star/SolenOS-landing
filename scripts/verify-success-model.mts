/**
 * verify-success-model.mts
 * Success model — outcome metrics, feature acceptance, recall from continuity.
 */

import fs from "node:fs";
import path from "node:path";

import { resetCareEventStore } from "../src/lib/care-events/store";
import { resetDareStore } from "../src/lib/data-acquisition-resilience";
import { resetIntegrityAuditStore } from "../src/lib/care-event-integrity";
import { resetMemoryLayerStore } from "../src/lib/care-memory-layers";
import { resetFailureResilienceStore } from "../src/lib/failure-resilience";
import { resetMoatStore } from "../src/lib/network-effect-moat";
import {
  ACTIVITY_METRICS,
  evaluateFeatureAcceptance,
  FEATURE_ACCEPTANCE_QUESTIONS,
  MIN_FEATURE_ACCEPTANCE_YES,
  PRIMARY_SUCCESS_METRICS,
  processSuccessModel,
  resetSuccessModelStore,
  SUCCESS_MODEL_IDENTITY,
} from "../src/lib/success-model";
import { resetCareContextRootStore, processSituationInput } from "../src/lib/situation-entry";
import { processFailureResilience } from "../src/lib/failure-resilience";
import { processTrustProvenance } from "../src/lib/trust-provenance";
import { processNetworkEffectMoat } from "../src/lib/network-effect-moat";
import { queryPriorityEvents } from "../src/lib/care-event-priority";
import { estimateContextWindowSize, processMemoryLayers } from "../src/lib/care-memory-layers";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== SolenOS Success Model ===\n");

resetCareContextRootStore();
resetCareEventStore();
resetDareStore();
resetIntegrityAuditStore();
resetMemoryLayerStore();
resetFailureResilienceStore();
resetMoatStore();
resetSuccessModelStore();

assert(SUCCESS_MODEL_IDENTITY.includes("care journey"), "success identity");
assert(PRIMARY_SUCCESS_METRICS.length === 5, "five primary metrics");
assert(ACTIVITY_METRICS.length >= 5, "activity metrics excluded");
assert(FEATURE_ACCEPTANCE_QUESTIONS.length === 6, "six acceptance questions");
console.log("✓ system contract");

const migration = path.join(root, "db/migrations/034_success_model.sql");
assert(fs.existsSync(migration), "migration 034 exists");
console.log("✓ migration 034");

const caregiverId = "cg_success";

const first = await processSituationInput({
  raw_input: "Mom fell yesterday and went to hospital",
  caregiver_id: caregiverId,
  timestamp: "2026-07-01T10:00:00.000Z",
});

assert(first.success_model_layer !== null, "success layer in response");
assert(first.success_model_layer!.overall_success_score >= 0, "overall score");
assert(first.success_model_layer!.primary.cognitive_load_reduction.score >= 0, "cognitive load metric");
assert(first.success_model_layer!.activity_metrics_excluded.includes("ai_conversations"), "activity excluded");
console.log("✓ outcome metrics on ingest");

await processSituationInput({
  raw_input: "Discharge summary — follow-up in 2 weeks",
  caregiver_id: caregiverId,
  timestamp: "2026-07-05T10:00:00.000Z",
});

const third = await processSituationInput({
  raw_input: "Insurance rejected the hospital claim",
  caregiver_id: caregiverId,
  timestamp: "2026-07-08T10:00:00.000Z",
});

assert(third.success_model_layer!.primary.continuity_restoration.score > 0, "continuity restoration");
assert(third.success_model_layer!.recall_probes.length >= 3, "recall probes");
console.log("✓ continuity restoration + recall probes");

const accepted = evaluateFeatureAcceptance("Test feature", [true, true, true, true, true, false]);
assert(accepted.accepted, "feature accepted with 5 yes");
const rejected = evaluateFeatureAcceptance("Bad feature", [false, false, false, false, false, false]);
assert(!rejected.accepted, "feature rejected");
assert(rejected.required_yes === MIN_FEATURE_ACCEPTANCE_YES, "acceptance threshold");
console.log("✓ feature acceptance rule");

assert(third.success_model_layer!.system_quality.extraction_confidence.score >= 0, "system quality");
assert(third.success_model_layer!.user_trust.fabricated_events.score === 100, "zero fabricated events");
assert(third.success_model_layer!.longitudinal.connected_events.score >= 0, "longitudinal metrics");
console.log("✓ system quality + trust + longitudinal");

const ctx = third.context;
const memory = processMemoryLayers({ caregiver_id: caregiverId, events: ctx.events });
const priorityQuery = queryPriorityEvents(ctx.events);
const failure = processFailureResilience({
  caregiver_id: caregiverId,
  dare: null,
  events_created: third.events_created,
  prior_events: ctx.events.slice(0, -third.events_created.length),
  raw_input: "",
});
const trust = processTrustProvenance({
  caregiver_id: caregiverId,
  events_created: third.events_created,
  context_events: ctx.events,
  dare: null,
  unresolved_questions: [],
  what_changed: third.what_changed,
});
const moat = processNetworkEffectMoat({
  caregiver_id: caregiverId,
  new_events: third.events_created,
  prior_events: ctx.events.slice(0, -third.events_created.length),
  all_events: ctx.events,
  unresolved_questions: [],
  what_changed: third.what_changed,
  dare: null,
});
const manual = processSuccessModel({
  caregiver_id: caregiverId,
  events: ctx.events,
  events_created: third.events_created,
  what_changed: third.what_changed,
  unresolved_questions: [],
  dare: null,
  failure,
  trust,
  moat,
  top_event_ids: priorityQuery.top_events.map((e) => e.id),
  attention_event_ids: priorityQuery.attention_events.map((e) => e.id),
  context_window_chars: estimateContextWindowSize(memory.context_window),
  has_active_episode: memory.store.active_episode_id !== null,
});
assert(manual.outcome_summary.length > 0, "outcome summary");
console.log("✓ pipeline orchestration");

const apiRoute = path.join(root, "src/app/api/situation/success/route.ts");
assert(fs.existsSync(apiRoute), "success API route");
console.log("✓ success API route");

const uiPanel = path.join(root, "src/components/ops-devtools/SuccessModelPanel.tsx");
assert(fs.existsSync(uiPanel), "SuccessModelPanel exists");
console.log("✓ UI panel");

console.log("\n=== All success model checks passed ===\n");
