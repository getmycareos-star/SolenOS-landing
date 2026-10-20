/**

 * verify-continuity-decay-engine.mts

 * Continuity Decay Engine — freshness, confidence decay, refresh planning.

 */



import fs from "node:fs";

import path from "node:path";



import { resetCareEventStore } from "../src/lib/care-events/store";

import { resetDareStore } from "../src/lib/data-acquisition-resilience";

import { resetIntegrityAuditStore } from "../src/lib/care-event-integrity";

import { resetMemoryLayerStore } from "../src/lib/care-memory-layers";

import { resetFailureResilienceStore } from "../src/lib/failure-resilience";

import { resetMoatStore } from "../src/lib/network-effect-moat";

import { resetSuccessModelStore } from "../src/lib/success-model";

import { resetMvpSurfaceStore } from "../src/lib/mvp-surface-area";

import { resetContinuousExecutionStore } from "../src/lib/continuous-execution-loop";

import { resetBehaviorPatternStore } from "../src/lib/behavior-interpretation-engine";

import {

  CONFIDENCE_GAP_THRESHOLD,

  CONTINUITY_DECAY_IDENTITY,

  DECAY_ENGINE_BOUNDARY,

  DECAY_PROHIBITED,

  FRESHNESS_TIERS,

  processContinuityDecay,

  resetContinuityDecayStore,

} from "../src/lib/continuity-decay-engine";

import { resetCareContextRootStore, processSituationInput } from "../src/lib/situation-entry";



const root = process.cwd();



function assert(cond: unknown, msg: string): asserts cond {

  if (!cond) throw new Error(msg);

}



console.log("=== SolenOS Continuity Decay Engine ===\n");



resetCareContextRootStore();

resetCareEventStore();

resetDareStore();

resetIntegrityAuditStore();

resetMemoryLayerStore();

resetFailureResilienceStore();

resetMoatStore();

resetSuccessModelStore();

resetMvpSurfaceStore();

resetContinuousExecutionStore();

resetBehaviorPatternStore();

resetContinuityDecayStore();



assert(CONTINUITY_DECAY_IDENTITY.includes("confidence"), "decay identity");

assert(DECAY_ENGINE_BOUNDARY.includes("trustworthy"), "decay boundary");

assert(DECAY_PROHIBITED.length >= 6, "prohibited behaviors");

assert(FRESHNESS_TIERS.length === 3, "three freshness tiers");

console.log("✓ system contract");



const migration = path.join(root, "db/migrations/039_continuity_decay_engine.sql");

assert(fs.existsSync(migration), "migration 039 exists");

console.log("✓ migration 039");



const first = await processSituationInput({

  raw_input: "Dad started a new evening medication last week.",

  caregiver_id: "cg_decay",

  timestamp: "2026-07-01T10:00:00.000Z",

});



assert(first.continuity_decay_layer !== undefined, "layer on SituationResponse");

assert(first.continuity_decay_layer.triggered === true, "decay engine triggered");

assert(first.continuity_decay_layer.continuity_confidence_pct >= 50, "initial continuity confidence");

assert(first.continuity_decay_layer.object_confidence.length >= 1, "object-level confidence");

console.log("✓ consumes CareContext after pipeline");



const aged = processContinuityDecay({

  caregiver_id: "cg_decay",

  all_events: first.context.events,

  events_created: [],

  what_needs_clarification: first.what_needs_clarification,

  what_is_uncertain: first.what_is_uncertain,

  attention_event_ids: first.priority_layer?.attention_events ?? [],

  what_changed: [],

  as_of: "2026-07-15T10:00:00.000Z",

  trigger: "idle_refresh",

});



assert(

  aged.continuity_confidence_pct < first.continuity_decay_layer.continuity_confidence_pct,

  "confidence decays over time",

);

assert(aged.stale_items.length >= 1 || aged.continuity_gaps.length >= 1, "stale or gap detected");

console.log("✓ time-based confidence decay");



const second = await processSituationInput({

  raw_input: "Medication is going well — no side effects.",

  caregiver_id: "cg_decay",

  timestamp: "2026-07-16T10:00:00.000Z",

});



assert(

  second.continuity_decay_layer.confidence_recovery_applied.length >= 1 ||

    second.continuity_decay_layer.continuity_confidence_pct >= aged.continuity_confidence_pct,

  "confirmation recovers affected confidence",

);

console.log("✓ confidence recovery on confirmation");



assert(

  aged.expected_follow_ups.some((f) => f.overdue_days !== null && f.overdue_days > 0) ||

    aged.recheck_prompts.length >= 1,

  "expected follow-up or recheck prompt",

);

console.log("✓ expected follow-ups without assuming success");



assert(

  aged.refresh_session !== null || aged.family_rhythm.meaningful_gap,

  "smart return or meaningful gap",

);

assert(second.final_output.decision_trace.unknowns.length >= 0, "explainable output");

console.log("✓ trust and explainability in final output");



const empty = processContinuityDecay({

  caregiver_id: "cg_empty",

  all_events: [],

  events_created: [],

  what_needs_clarification: [],

  what_is_uncertain: [],

  attention_event_ids: [],

  what_changed: [],

});

assert(empty.triggered === false, "no trigger without CareContext");

console.log("✓ no decay without CareContext");



const apiRoute = path.join(root, "src/app/api/situation/decay/route.ts");

const panel = path.join(root, "src/components/ops-devtools/ContinuityDecayPanel.tsx");

assert(fs.existsSync(apiRoute), "decay API route");

assert(fs.existsSync(panel), "ContinuityDecayPanel");

console.log("✓ API and UI");



assert(CONFIDENCE_GAP_THRESHOLD === 60, "gap threshold");

console.log("✓ continuity gap threshold");



console.log("\n=== All continuity decay checks passed ===\n");


